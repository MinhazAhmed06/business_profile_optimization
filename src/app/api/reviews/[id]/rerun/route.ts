import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { scrapeGoogleReviews } from '@/lib/reviewScraper';
import { analyzeReviews } from '@/lib/reviewAnalyzer';
import { analyzeSentiment } from '@/lib/sentimentEngine';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const analysis = await prisma.reviewAnalysis.findUnique({
        where: { id },
    });

    if (!analysis) {
        return NextResponse.json({ error: 'Review analysis not found' }, { status: 404 });
    }

    if (!analysis.businessUrl) {
        return NextResponse.json({ error: 'No business URL found for this analysis' }, { status: 400 });
    }

    // Set up SSE stream
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendLog = async (message: string, type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
        try {
            await writer.write(
                encoder.encode(`data: ${JSON.stringify({ message, type, timestamp: new Date().toISOString() })}\n\n`)
            );
        } catch {
            // Stream might be closed by client
        }
    };

    // Run the rerun process asynchronously
    (async () => {
        try {
            if (analysis.status === 'SCRAPING' || analysis.status === 'ANALYZING') {
                await sendLog('Analysis is already running', 'error');
                await writer.close();
                return;
            }

            const existingRuns = await prisma.review.findMany({
                where: { analysisId: id },
                distinct: ['runId'],
                select: { runId: true }
            });

            const runNumber = existingRuns.length;
            const newRunId = `${id}-run${runNumber}`;
            const runAt = new Date();

            await sendLog(`Starting rerun #${runNumber + 1} for "${analysis.businessName}"...`);

            await prisma.reviewAnalysis.update({
                where: { id },
                data: {
                    status: 'SCRAPING',
                    currentRunId: newRunId,
                    error: null
                }
            });

            // Scrape fresh reviews
            await sendLog(`Scraping reviews from ${analysis.businessUrl}...`);
            const onProgress = (msg: string) => sendLog(msg);
            const { business, reviews } = await scrapeGoogleReviews(analysis.businessUrl, onProgress);

            await sendLog(`Scraped ${reviews.length} reviews. Saving to database...`);

            await prisma.reviewAnalysis.update({
                where: { id },
                data: {
                    businessName: business.name,
                    totalReviews: business.totalReviews,
                    averageRating: business.averageRating,
                    placeId: business.placeId,
                    status: 'ANALYZING',
                },
            });

            // Save reviews in batched multi-row inserts
            const chunkSize = 50;
            for (let i = 0; i < reviews.length; i += chunkSize) {
                const chunk = reviews.slice(i, i + chunkSize);
                await prisma.review.createMany({
                    data: chunk.map((r, idx) => ({
                        id: `${id}-${newRunId}-${i + idx}`,
                        analysisId: id,
                        runId: newRunId,
                        runAt,
                        reviewerName: r.reviewerName || 'Customer',
                        reviewerUrl: r.reviewerUrl || null,
                        reviewImage: r.reviewImage || null,
                        reviewCount: r.reviewCount ?? null,
                        photoCount: r.photoCount ?? null,
                        rating: r.rating,
                        text: r.text || null,
                        publishedDate: r.publishedDate || null,
                        responseText: r.responseText || null,
                        responseDate: r.responseDate || null,
                    }))
                });
                await sendLog(`Saved ${Math.min(i + chunkSize, reviews.length)} / ${reviews.length} reviews...`);
            }

            // Re-analyze
            await sendLog('Running 150+ metric deep analysis...');
            const analysisResult = analyzeReviews(reviews);

            // Sentiment enrichment
            await sendLog('Analyzing sentiment and fake patterns...');
            const dbReviews = await prisma.review.findMany({
                where: { analysisId: id, runId: newRunId },
                select: { id: true, text: true, rating: true, reviewCount: true, photoCount: true }
            });

            // Batch sentiment updates
            const SENTIMENT_BATCH_SIZE = 50;
            for (let i = 0; i < dbReviews.length; i += SENTIMENT_BATCH_SIZE) {
                const batch = dbReviews.slice(i, i + SENTIMENT_BATCH_SIZE);
                const updates = batch.map(r => {
                    const sent = analyzeSentiment(r.text, Number(r.rating));

                    let fakeScore = 0;
                    if (!r.text || r.text.length < 20) fakeScore += 15;
                    if (r.reviewCount != null && Number(r.reviewCount) <= 1) fakeScore += 20;
                    if (!r.photoCount) fakeScore += 5;

                    return prisma.review.update({
                        where: { id: r.id },
                        data: {
                            sentimentScore: sent.score,
                            sentimentLabel: sent.label,
                            fakeScore: fakeScore,
                            isLikelyFake: fakeScore > 30,
                        },
                    });
                });
                await prisma.$transaction(updates);
            }

            // Update analysis with final JSON data
            await prisma.reviewAnalysis.update({
                where: { id },
                data: {
                    analysisData: JSON.stringify(analysisResult),
                    status: 'COMPLETED',
                },
            });

            await sendLog('Rerun completed successfully!', 'success');
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', success: true })}\n\n`));
            await writer.close();
        } catch (error: any) {
            console.error('Rerun failed:', error);
            await sendLog(`Rerun failed: ${error.message}`, 'error');
            await prisma.reviewAnalysis.update({
                where: { id },
                data: {
                    status: 'FAILED',
                    error: error.message,
                },
            }).catch(() => { });
            await writer.close();
        }
    })();

    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
