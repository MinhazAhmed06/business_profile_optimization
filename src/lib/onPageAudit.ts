export interface OnPageAuditResult {
  url: string;
  reachable: boolean;
  ssl: boolean;
  loadTimeMs: number;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1Count: number;
  h1Text: string | null;
  hasLocalBusinessSchema: boolean;
  hasViewportMeta: boolean;
  healthScore: number; // 0 - 100
  issues: string[];
}

export async function runOnPageAudit(rawUrl?: string | null): Promise<OnPageAuditResult | null> {
  if (!rawUrl) return null;
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LocalSEOAuditBot/1.0)' }
    });
    clearTimeout(timeout);

    const html = await res.text();
    const loadTimeMs = Date.now() - start;
    const ssl = url.startsWith('https://');

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const descMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
    const metaDescription = descMatch ? descMatch[1].trim() : null;

    const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
    const h1Text = h1Matches.length > 0 ? h1Matches[0][1].replace(/<[^>]+>/g, '').trim() : null;

    const hasLocalBusinessSchema = /LocalBusiness|ProfessionalService|MedicalBusiness|Store|Restaurant/i.test(html);
    const hasViewportMeta = /<meta[^>]*name=["']viewport["']/i.test(html);

    const issues: string[] = [];
    let score = 100;

    if (!ssl) { score -= 20; issues.push('Missing HTTPS / SSL security certificate'); }
    if (!title) { score -= 20; issues.push('Missing HTML Title tag'); }
    else if (title.length < 20 || title.length > 65) { score -= 10; issues.push(`Suboptimal Title length (${title.length} chars)`); }
    if (!metaDescription) { score -= 15; issues.push('Missing Meta Description tag'); }
    if (h1Matches.length === 0) { score -= 20; issues.push('Missing primary H1 heading on homepage'); }
    else if (h1Matches.length > 1) { score -= 5; issues.push(`Multiple H1 tags detected (${h1Matches.length})`); }
    if (!hasLocalBusinessSchema) { score -= 15; issues.push('No LocalBusiness JSON-LD Schema markup found'); }
    if (loadTimeMs > 2500) { score -= 10; issues.push(`Slow initial server response (${loadTimeMs}ms)`); }

    return {
      url,
      reachable: res.ok,
      ssl,
      loadTimeMs,
      title,
      titleLength: title?.length || 0,
      metaDescription,
      metaDescriptionLength: metaDescription?.length || 0,
      h1Count: h1Matches.length,
      h1Text,
      hasLocalBusinessSchema,
      hasViewportMeta,
      healthScore: Math.max(0, score),
      issues
    };
  } catch {
    return {
      url,
      reachable: false,
      ssl: url.startsWith('https://'),
      loadTimeMs: Date.now() - start,
      title: null,
      titleLength: 0,
      metaDescription: null,
      metaDescriptionLength: 0,
      h1Count: 0,
      h1Text: null,
      hasLocalBusinessSchema: false,
      hasViewportMeta: false,
      healthScore: 0,
      issues: ['Website unreachable or timed out (>4.5s)']
    };
  }
}
