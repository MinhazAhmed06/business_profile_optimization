import React from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { OnPageAuditResult } from '@/lib/onPageAudit';
import ClientHeatmapGrid from '@/components/ClientHeatmapGrid';
import {
  MapPin,
  TrendingUp,
  Globe,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Zap,
  Target
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ shareSlug: string }>;
}

export default async function PublicPitchReportPage({ params }: PageProps) {
  const { shareSlug } = await params;

  const scan = await prisma.scan.findUnique({
    where: { shareSlug },
    include: {
      user: {
        select: {
          agencyName: true,
          agencyLogoUrl: true,
          brandColor: true,
          bookingUrl: true,
          websiteUrl: true
        }
      },
      results: {
        select: {
          lat: true,
          lng: true,
          rank: true,
          topResults: true
        }
      }
    }
  });

  if (!scan || !scan.isPublic) {
    notFound();
  }

  const agencyName = scan.user?.agencyName || 'Local SEO Intelligence';
  const brandColor = scan.user?.brandColor || '#2563eb';
  const bookingUrl = scan.user?.bookingUrl || '#';

  const onPageAudit: OnPageAuditResult | null = scan.onPageAudit
    ? JSON.parse(scan.onPageAudit)
    : null;

  const aiPitchReport: any = scan.aiPitchReport
    ? JSON.parse(scan.aiPitchReport)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Top White-Label Agency Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {scan.user?.agencyLogoUrl ? (
              <img
                src={scan.user.agencyLogoUrl}
                alt={agencyName}
                className="h-9 w-auto object-contain rounded"
              />
            ) : (
              <div
                className="h-9 px-3 rounded-lg flex items-center justify-center font-bold text-white text-sm tracking-wide"
                style={{ backgroundColor: brandColor }}
              >
                {agencyName}
              </div>
            )}
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Verified Local Ranking Audit
            </span>
          </div>

          {bookingUrl !== '#' && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: brandColor }}
            >
              <Calendar className="w-4 h-4" />
              Book Strategy Call
            </a>
          )}
        </div>
      </header>

      {/* Hero Headline & Target Info */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Target className="w-3.5 h-3.5" />
                Google Maps SERP Intelligence
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {scan.businessName || 'Local Business'} Ranking Report
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                Target Search Query:{' '}
                <span className="text-slate-200 font-semibold bg-slate-800 px-2.5 py-0.5 rounded">
                  &quot;{scan.keyword}&quot;
                </span>{' '}
                across a {scan.gridSize}×{scan.gridSize} geographic service grid ({scan.pinsCount || scan.results.length} checkpoints).
              </p>
            </div>

            {bookingUrl !== '#' && (
              <div className="flex-shrink-0">
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-xl transition-all hover:opacity-90"
                  style={{ backgroundColor: brandColor }}
                >
                  Fix My Rankings
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>

          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Share of Voice
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {scan.sov !== null ? `${scan.sov}%` : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Top-3 Pack Visibility</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Average Rank
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {scan.arp !== null ? `#${scan.arp}` : 'Unranked'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">When found in Top 20</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Top 3 Pins
              </div>
              <div className="text-2xl font-black text-green-400 mt-1">
                {scan.top3Count} / {scan.pinsCount || scan.results.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Prime conversion zones</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Unranked Pins
              </div>
              <div className="text-2xl font-black text-red-400 mt-1">
                {scan.unrankedCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Drop-off blind spots</div>
            </div>
          </div>
        </div>

        {/* Heatmap Section */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Geographic Heatmap Grid
              </h2>
              <p className="text-xs text-slate-400">
                Click any pin to inspect the top 3 competitors outranking you at that exact coordinate.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> #1–3
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> #4–10
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> #11–20
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-slate-700 inline-block" /> 20+
              </span>
            </div>
          </div>

          <ClientHeatmapGrid
            centerLat={scan.centerLat}
            centerLng={scan.centerLng}
            zoom={13}
            results={scan.results}
            businessName={scan.businessName}
          />
        </section>

        {/* AI Pitch & Strategic Insights Card */}
        {aiPitchReport && (
          <section className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap className="w-3.5 h-3.5" />
                Strategic Recovery Analysis
              </div>
              <h3 className="text-xl font-bold text-white">
                {aiPitchReport.headlineHook || 'Local Market Share Assessment'}
              </h3>
            </div>

            {/* Competitor Leaderboard */}
            {aiPitchReport.topCompetitors && aiPitchReport.topCompetitors.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Top Competitors Dominating Your Map Pack
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {aiPitchReport.topCompetitors.map((comp: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-blue-400 mb-1">
                          #{idx + 1} Market Leader
                        </div>
                        <div className="font-bold text-slate-100 truncate text-sm">
                          {comp.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {comp.category || 'Local Business'}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Reviews:</span>
                        <span className="font-bold text-slate-200">
                          {comp.reviews ? `${comp.reviews} (${comp.rating || '★'}★)` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Action Plan */}
            {aiPitchReport.quickFixes && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Recommended 30-Day Recovery Priorities
                </h4>
                <ul className="space-y-2">
                  {aiPitchReport.quickFixes.map((fix: string, idx: number) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 text-sm text-slate-300 bg-slate-900/50 border border-slate-800/60 rounded-lg p-3"
                    >
                      <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Website SEO Health Card */}
        {onPageAudit && (
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  Website On-Page SEO Health
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-lg">
                  Analyzed URL: {onPageAudit.url}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-slate-400">Health Score</div>
                  <div
                    className={`text-2xl font-black ${
                      onPageAudit.healthScore >= 80
                        ? 'text-emerald-400'
                        : onPageAudit.healthScore >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {onPageAudit.healthScore}/100
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  SSL Certificate
                </div>
                <div className="text-sm font-bold text-slate-200 mt-1">
                  {onPageAudit.ssl ? 'Secure (HTTPS)' : 'Insecure (HTTP)'}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Zap className="w-4 h-4 text-slate-400" />
                  Server Response
                </div>
                <div className="text-sm font-bold text-slate-200 mt-1">
                  {onPageAudit.loadTimeMs}ms
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-slate-400" />
                  Local Schema
                </div>
                <div className="text-sm font-bold text-slate-200 mt-1">
                  {onPageAudit.hasLocalBusinessSchema ? 'Present' : 'Missing'}
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Globe className="w-4 h-4 text-slate-400" />
                  H1 Heading
                </div>
                <div className="text-sm font-bold text-slate-200 mt-1">
                  {onPageAudit.h1Count > 0 ? `${onPageAudit.h1Count} Found` : 'Missing'}
                </div>
              </div>
            </div>

            {onPageAudit.issues.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Identified Ranking Impediments:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {onPageAudit.issues.map((issue: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2"
                    >
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* High-Converting Bottom Pitch Banner */}
        {bookingUrl !== '#' && (
          <section
            className="rounded-2xl p-8 sm:p-10 text-center space-y-4 shadow-2xl relative overflow-hidden"
            style={{ backgroundColor: brandColor }}
          >
            <div className="max-w-2xl mx-auto space-y-2">
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                Ready to dominate your local Google Maps service area?
              </h3>
              <p className="text-white/80 text-sm sm:text-base">
                We specialize in helping local businesses outrank their competitors, capture more phone calls, and expand their 3-pack radius.
              </p>
            </div>

            <div className="pt-2">
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-extrabold text-slate-900 bg-white hover:bg-slate-100 shadow-xl transition-all active:scale-95 text-base"
              >
                Schedule Your Free Audit Review
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
        <p>
          Report generated by <span className="text-slate-400 font-semibold">{agencyName}</span> using verified Google Maps SERP telemetry.
        </p>
      </footer>
    </div>
  );
}
