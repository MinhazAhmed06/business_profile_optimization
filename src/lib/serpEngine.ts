import pLimit from 'p-limit';
import { prisma } from './prisma';
import { logger } from './logger';
import { runOnPageAudit } from './onPageAudit';

export interface SerpPointParam {
  lat: number;
  lng: number;
}

export interface SerpListing {
  rank: number;
  name: string;
  placeId?: string;
  cid?: string;
  rating?: number;
  reviews?: number;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  isSAB?: boolean;
}

export interface ScrapeResult extends SerpListing {
  url?: string;
  priceLevel?: string;
  allCategories?: string[];
  attributes?: string[];
  hours?: string;
  photosCount?: number;
  yearsInBusiness?: number;
  openNow?: boolean;
  profileCompleteness?: number;
  businessProfileId?: string;
}

export interface ISerpEngine {
  readonly name: string;
  searchPoint(keyword: string, lat: number, lng: number): Promise<SerpListing[]>;
}

export class DataForSeoEngine implements ISerpEngine {
  readonly name = 'DataForSEO';
  private login = process.env.DATAFORSEO_LOGIN || '';
  private password = process.env.DATAFORSEO_PASSWORD || '';

  async searchPoint(keyword: string, lat: number, lng: number): Promise<SerpListing[]> {
    if (!this.login || !this.password) {
      throw new Error('DataForSEO credentials missing (DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD)');
    }

    const auth = Buffer.from(`${this.login}:${this.password}`).toString('base64');
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/maps/live/advanced', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keyword,
        location_coordinate: `${lat.toFixed(6)},${lng.toFixed(6)},15z`,
        language_code: 'en',
        depth: 20
      }]),
    });

    if (!response.ok) {
      throw new Error(`DataForSEO HTTP ${response.status}: ${await response.text()}`);
    }

    const json = await response.json();
    const rawItems = json?.tasks?.[0]?.result?.[0]?.items || [];
    // Filter out sponsored ads so rankings reflect true organic positions
    const organicItems = rawItems.filter((item: any) => item.type === 'maps_search');

    return organicItems.slice(0, 20).map((item: any, idx: number): SerpListing => ({
      rank: item.rank_group || idx + 1,
      name: item.title || '',
      placeId: item.place_id || undefined,
      cid: item.cid || undefined,
      rating: item.rating?.value || undefined,
      reviews: item.rating?.votes_count || undefined,
      category: item.category || undefined,
      address: item.address || undefined,
      phone: item.phone || undefined,
      website: item.url || undefined,
      latitude: item.latitude || undefined,
      longitude: item.longitude || undefined,
      isSAB: item.is_service_area_business || false
    }));
  }
}

export class SerperDevEngine implements ISerpEngine {
  readonly name = 'Serper.dev';
  private apiKey = process.env.SERPER_API_KEY || '';

  async searchPoint(keyword: string, lat: number, lng: number): Promise<SerpListing[]> {
    if (!this.apiKey) {
      throw new Error('Serper.dev API key missing (SERPER_API_KEY)');
    }

    const response = await fetch('https://google.serper.dev/places', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: keyword,
        ll: `@${lat.toFixed(6)},${lng.toFixed(6)},15z`,
        hl: 'en'
      }),
    });

    if (!response.ok) {
      throw new Error(`Serper HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const places = data.places || [];

    return places.slice(0, 20).map((p: any, idx: number): SerpListing => ({
      rank: p.position || idx + 1,
      name: p.title || '',
      placeId: p.placeId || undefined,
      cid: p.cid || undefined,
      rating: p.rating || undefined,
      reviews: p.ratingCount || undefined,
      category: p.category || undefined,
      address: p.address || undefined,
      phone: p.phoneNumber || undefined,
      website: p.website || undefined,
      latitude: p.latitude || undefined,
      longitude: p.longitude || undefined,
      isSAB: !p.address
    }));
  }
}

export class ResilientSerpEngine implements ISerpEngine {
  readonly name = 'ResilientEngine';
  private primary: ISerpEngine;
  private fallback: ISerpEngine;

  constructor() {
    const preferSerper = process.env.PRIMARY_SERP_PROVIDER === 'serper';
    this.primary = preferSerper ? new SerperDevEngine() : new DataForSeoEngine();
    this.fallback = preferSerper ? new DataForSeoEngine() : new SerperDevEngine();
  }

  async searchPoint(keyword: string, lat: number, lng: number): Promise<SerpListing[]> {
    try {
      return await this.primary.searchPoint(keyword, lat, lng);
    } catch (primaryErr: any) {
      logger.warn(`[SerpEngine] Primary (${this.primary.name}) failed: ${primaryErr.message}. Switching to ${this.fallback.name}...`);
      return await this.fallback.searchPoint(keyword, lat, lng);
    }
  }
}

export const defaultSerpEngine = new ResilientSerpEngine();

export async function executeParallelScan(scanId: string): Promise<void> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { user: true }
  });

  if (!scan) throw new Error(`Scan ${scanId} not found`);

  const points: SerpPointParam[] = scan.customPoints ? JSON.parse(scan.customPoints) : [];
  if (points.length === 0) throw new Error('Scan has 0 grid coordinates');

  await prisma.scan.update({
    where: { id: scanId },
    data: { status: 'RUNNING' }
  });

  const concurrency = parseInt(process.env.SERP_CONCURRENCY_LIMIT || '15', 10);
  const limit = pLimit(concurrency);
  const runId = `run-${Date.now()}`;
  const runAt = new Date();
  const cleanTarget = (scan.businessName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let failedPointsCount = 0;
  let detectedWebsiteUrl = scan.websiteUrl || null;

  try {
    const pointTasks = points.map((pt) =>
      limit(async () => {
        try {
          const listings = await defaultSerpEngine.searchPoint(scan.keyword, pt.lat, pt.lng);

          let foundRank: number | null = null;
          let matchedPlaceId: string | null = null;
          let matchedCid: string | null = null;

          for (const item of listings) {
            const cleanName = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matchByName = cleanTarget.length >= 3 && cleanName.includes(cleanTarget);
            const matchByPlace = Boolean(scan.placeId && item.placeId === scan.placeId);

            if (matchByPlace || matchByName) {
              foundRank = item.rank;
              matchedPlaceId = item.placeId || null;
              matchedCid = item.cid || null;
              if (!detectedWebsiteUrl && item.website) {
                detectedWebsiteUrl = item.website;
              }
              break;
            }
          }

          return {
            scanId: scan.id,
            runId,
            runAt,
            lat: pt.lat,
            lng: pt.lng,
            rank: foundRank,
            targetName: scan.businessName,
            placeId: matchedPlaceId,
            cid: matchedCid,
            topResults: JSON.stringify(listings)
          };
        } catch (pointErr: any) {
          failedPointsCount++;
          logger.error(`[SerpEngine] Coordinate ${pt.lat},${pt.lng} failed: ${pointErr.message}`);
          return {
            scanId: scan.id,
            runId,
            runAt,
            lat: pt.lat,
            lng: pt.lng,
            rank: null,
            targetName: scan.businessName,
            placeId: null,
            cid: null,
            topResults: JSON.stringify([])
          };
        }
      })
    );

    // Parallel fetch of all grid pins
    const results = await Promise.all(pointTasks);

    // Failure Guard: Auto-refund credits if >25% of requests failed
    if (failedPointsCount > points.length * 0.25) {
      throw new Error(`SERP_PROVIDER_FAILURE: ${failedPointsCount}/${points.length} coordinate checks failed.`);
    }

    // Run on-page audit with auto-discovered or user-provided website URL
    const onPageAudit = await runOnPageAudit(detectedWebsiteUrl);

    await prisma.result.createMany({ data: results });

    const rankedRanks = results.map(r => r.rank).filter((r): r is number => r !== null);
    const totalPins = results.length;
    const arp = rankedRanks.length > 0
      ? Number((rankedRanks.reduce((a, b) => a + b, 0) / rankedRanks.length).toFixed(2))
      : null;

    const atrpSum = results.reduce((sum, r) => sum + (r.rank !== null ? r.rank : 21), 0);
    const atrp = Number((atrpSum / totalPins).toFixed(2));

    const top3 = results.filter(r => r.rank !== null && r.rank <= 3).length;
    const top10 = results.filter(r => r.rank !== null && r.rank <= 10).length;
    const unranked = results.filter(r => r.rank === null).length;
    const sov = Number(((top3 / totalPins) * 100).toFixed(1));

    // Extract top 3 competitors across the grid
    const competitorMap = new Map<string, { name: string; countTop3: number; rating?: number; reviews?: number; category?: string }>();
    for (const r of results) {
      const parsed: SerpListing[] = JSON.parse(r.topResults);
      for (const item of parsed.slice(0, 3)) {
        if (scan.businessName && item.name.toLowerCase().includes(scan.businessName.toLowerCase())) continue;
        const existing = competitorMap.get(item.name) || { name: item.name, countTop3: 0, rating: item.rating, reviews: item.reviews, category: item.category };
        existing.countTop3 += 1;
        competitorMap.set(item.name, existing);
      }
    }
    const topCompetitors = [...competitorMap.values()].sort((a, b) => b.countTop3 - a.countTop3).slice(0, 3);

    const aiPitchReport = {
      generatedAt: new Date().toISOString(),
      headlineHook: `${scan.businessName || 'Your business'} is invisible in ${Math.round(((totalPins - top3) / totalPins) * 100)}% of local "${scan.keyword}" searches.`,
      topCompetitors,
      coldCallScript: `Hey, I just ran a ${totalPins}-point Google Maps heatmap around your area for "${scan.keyword}". Right now you're only showing up in the Top 3 on ${top3} out of ${totalPins} blocks (${sov}% Share of Voice), while ${topCompetitors[0]?.name || 'your top competitor'} is capturing ${topCompetitors[0]?.countTop3 || 0} blocks with ${topCompetitors[0]?.reviews || 'more'} reviews. I put together a public map link showing the exact streets where you're dropping off—mind if I text it over?`,
      quickFixes: [
        topCompetitors[0]?.category ? `Align primary/secondary GBP category with "${topCompetitors[0].category}"` : 'Audit primary GBP category against top 3 map pack leaders',
        onPageAudit && onPageAudit.issues.length > 0 ? `Fix Website SEO issue: ${onPageAudit.issues[0]}` : `Embed "${scan.keyword}" + neighborhood modifiers into homepage H1 and LocalBusiness schema`,
        `Close the review velocity gap against ${topCompetitors[0]?.name || 'top local competitors'} (${topCompetitors[0]?.reviews || 50}+ reviews)`
      ]
    };

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: 'COMPLETED',
        currentRunId: runId,
        websiteUrl: detectedWebsiteUrl,
        pinsCount: totalPins,
        top3Count: top3,
        top10Count: top10,
        unrankedCount: unranked,
        arp,
        atrp,
        sov,
        onPageAudit: onPageAudit ? JSON.stringify(onPageAudit) : null,
        aiPitchReport: JSON.stringify(aiPitchReport)
      }
    });

  } catch (err: any) {
    logger.error(`[SerpEngine] Scan ${scanId} failed: ${err.message}`);
    // Auto-refund user credits on critical failure
    await prisma.$transaction([
      prisma.user.update({
        where: { id: scan.userId },
        data: { credits: { increment: points.length } }
      }),
      prisma.creditTransaction.create({
        data: {
          userId: scan.userId,
          amount: points.length,
          type: 'SCAN_REFUND',
          description: `Auto-refund for failed scan #${scanId} (${err.message.slice(0, 80)})`,
          scanId: scan.id
        }
      }),
      prisma.scan.update({
        where: { id: scanId },
        data: { status: 'FAILED' }
      })
    ]).catch((refundErr) => {
      logger.error(`[SerpEngine] Failed to process auto-refund: ${refundErr.message}`);
    });
    throw err;
  }
}
