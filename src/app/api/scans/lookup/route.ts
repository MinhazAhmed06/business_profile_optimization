import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { defaultSerpEngine } from '@/lib/serpEngine';

export const dynamic = 'force-dynamic';

function hexCidToDecimal(hexCid: string): string {
  try {
    const hex = hexCid.replace(/^0x/, '');
    return BigInt('0x' + hex).toString();
  } catch {
    return hexCid;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, url } = body;

    if (!query && !url) {
      return NextResponse.json({ error: 'Query or URL is required' }, { status: 400 });
    }

    let lat: number | null = null;
    let lng: number | null = null;
    let name: string = '';
    let address: string = '';
    let cid: string = '';
    let placeId: string = '';
    let rating: number = 0;
    let reviews: number = 0;
    let category: string = '';
    let website: string = '';

    // Case 1: Google Maps URL was provided
    if (url) {
      try {
        const res = await fetch(url, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        });

        const finalUrl = res.url || url;

        // Extract coordinates from URL @lat,lng
        const coordMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) {
          lat = parseFloat(coordMatch[1]);
          lng = parseFloat(coordMatch[2]);
        }

        // Extract CID from URL (0x...:0x...)
        const cidMatch = finalUrl.match(/0x[\da-fA-F]+:0x([\da-fA-F]+)/);
        if (cidMatch) {
          cid = hexCidToDecimal(cidMatch[1]);
        }

        // Extract Place ID from URL if present
        const placeIdMatch = finalUrl.match(/!1s(ChIJ[a-zA-Z0-9_-]+)/);
        if (placeIdMatch) {
          placeId = placeIdMatch[1];
        }

        // Extract name from path e.g. /maps/place/Name+Here/
        const namePathMatch = finalUrl.match(/\/maps\/place\/([^/@?]+)/);
        if (namePathMatch) {
          name = decodeURIComponent(namePathMatch[1].replace(/\+/g, ' '));
        }

        // Fallback: parse HTML title
        const html = await res.text();
        if (!name) {
          const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (titleMatch) {
            const rawTitle = titleMatch[1].replace(/\s*[-–]\s*Google Maps/i, '').trim();
            name = rawTitle;
          }
        }
      } catch (urlErr: any) {
        logger.warn(`Failed to resolve URL directly: ${urlErr.message}`);
      }
    }

    // Case 2: Use query or search to populate full GBP metadata via SERP APIs
    const searchQuery = query || name;
    if (searchQuery && (!lat || !lng || !placeId || !cid)) {
      try {
        // If Serper is available, query Places API for instant metadata
        if (process.env.SERPER_API_KEY) {
          const serperRes = await fetch('https://google.serper.dev/places', {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: searchQuery,
              hl: 'en',
              ...(lat && lng ? { ll: `@${lat},${lng},15z` } : {})
            })
          });

          if (serperRes.ok) {
            const serperData = await serperRes.json();
            const topMatch = serperData.places?.[0];
            if (topMatch) {
              name = topMatch.title || name;
              address = topMatch.address || address;
              lat = topMatch.latitude || lat;
              lng = topMatch.longitude || lng;
              placeId = topMatch.placeId || placeId;
              cid = topMatch.cid || cid;
              rating = topMatch.rating || rating;
              reviews = topMatch.ratingCount || reviews;
              category = topMatch.category || category;
              website = topMatch.website || website;
            }
          }
        } else if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
          // Use DataForSEO engine if Serper is not configured
          const listings = await defaultSerpEngine.searchPoint(searchQuery, lat || 41.8781, lng || -87.6298);
          const topMatch = listings[0];
          if (topMatch) {
            name = topMatch.name || name;
            address = topMatch.address || address;
            lat = topMatch.latitude || lat;
            lng = topMatch.longitude || lng;
            placeId = topMatch.placeId || placeId;
            cid = topMatch.cid || cid;
            rating = topMatch.rating || rating;
            reviews = topMatch.reviews || reviews;
            category = topMatch.category || category;
            website = topMatch.website || website;
          }
        }
      } catch (serpErr: any) {
        logger.warn(`SERP lookup fell back: ${serpErr.message}`);
      }
    }

    return NextResponse.json({
      name: name || query || 'Unknown Business',
      lat: lat || 41.8781,
      lng: lng || -87.6298,
      address,
      cid,
      placeId,
      rating,
      reviews,
      category,
      website
    });

  } catch (error: any) {
    logger.error(`Business lookup failed: ${error.message}`);
    return NextResponse.json({ error: 'Failed to look up business' }, { status: 500 });
  }
}
