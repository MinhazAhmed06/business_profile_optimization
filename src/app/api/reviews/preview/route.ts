import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body?.url;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Business URL is required' }, { status: 400 });
    }

    let name = 'Unknown Business';
    let averageRating = 0;
    let totalReviews = 0;
    let placeId = '';

    // First attempt: Follow redirect and extract name & Place ID from Google Maps URL / HTML
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      const finalUrl = res.url || url;
      const html = await res.text();

      // Extract Place ID
      const placeMatch = finalUrl.match(/!1s(ChIJ[a-zA-Z0-9_-]+)/);
      if (placeMatch) placeId = placeMatch[1];

      // Extract Name from URL path
      const namePathMatch = finalUrl.match(/\/maps\/place\/([^/@?]+)/);
      if (namePathMatch) {
        name = decodeURIComponent(namePathMatch[1].replace(/\+/g, ' '));
      } else {
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) {
          name = titleMatch[1].replace(/\s*[-–]\s*Google Maps/i, '').trim();
        }
      }

      // Extract rating and reviews from meta tags or JSON-LD
      const ratingMatch = html.match(/"(\d\.\d)"\s*,\s*(\d+)\s*,\s*\[/);
      if (ratingMatch) {
        averageRating = parseFloat(ratingMatch[1]);
        totalReviews = parseInt(ratingMatch[2], 10);
      }
    } catch (fetchErr: any) {
      logger.warn(`Preview fetch failed: ${fetchErr.message}`);
    }

    // Second attempt: Enrich via Serper Places if ratings/reviews weren't in HTML
    if (process.env.SERPER_API_KEY && name !== 'Unknown Business') {
      try {
        const serperRes = await fetch('https://google.serper.dev/places', {
          method: 'POST',
          headers: {
            'X-API-KEY': process.env.SERPER_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ q: name, hl: 'en' })
        });
        if (serperRes.ok) {
          const data = await serperRes.json();
          const match = data.places?.[0];
          if (match) {
            averageRating = match.rating || averageRating;
            totalReviews = match.ratingCount || totalReviews;
            placeId = match.placeId || placeId;
          }
        }
      } catch {}
    }

    return NextResponse.json({
      name,
      averageRating,
      totalReviews,
      placeId
    });

  } catch (err: any) {
    logger.error(`Preview endpoint error: ${err.message}`);
    return NextResponse.json({ error: 'Failed to preview business' }, { status: 500 });
  }
}
