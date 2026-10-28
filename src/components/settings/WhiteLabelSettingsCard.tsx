'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Image as ImageIcon,
  Palette,
  Calendar,
  Globe,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Sparkles,
  Eye
} from 'lucide-react';

interface UserSettings {
  id?: string;
  email?: string;
  credits?: number;
  plan?: string;
  agencyName?: string | null;
  agencyLogoUrl?: string | null;
  brandColor?: string | null;
  bookingUrl?: string | null;
  websiteUrl?: string | null;
}

export default function WhiteLabelSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    agencyName: '',
    agencyLogoUrl: '',
    brandColor: '#2563eb',
    bookingUrl: '',
    websiteUrl: '',
  });

  const [credits, setCredits] = useState<number>(150);
  const [plan, setPlan] = useState<string>('FREE');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/settings');
      const data = await res.json();
      if (data.user) {
        setForm({
          agencyName: data.user.agencyName || '',
          agencyLogoUrl: data.user.agencyLogoUrl || '',
          brandColor: data.user.brandColor || '#2563eb',
          bookingUrl: data.user.bookingUrl || '',
          websiteUrl: data.user.websiteUrl || '',
        });
        setCredits(data.user.credits ?? 150);
        setPlan(data.user.plan || 'FREE');
      }
    } catch (err: any) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);

    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(data.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-slate-400">Loading Agency Branding Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Account & Credits Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Account Plan & Quota
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white capitalize">{plan} Tier</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {credits.toLocaleString()} Available Credits
            </span>
          </div>
          <p className="text-xs text-slate-400">
            1 grid point = 1 credit. A standard 7×7 audit uses 49 credits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {plan === 'FREE' && (
            <span className="text-xs text-blue-400 font-medium">
              Upgrade to Pro ($99/mo) for 5,000 monthly credits & custom branding
            </span>
          )}
        </div>
      </div>

      {/* Main Single-Card White-Label Form */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Agency White-Label Branding
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Customize how public audit reports (<code className="text-blue-300">/report/[shareSlug]</code>) appear to your prospective clients.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              Live Preview Below
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Agency Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Agency / Company Name
              </label>
              <input
                type="text"
                value={form.agencyName}
                onChange={(e) => setForm({ ...form, agencyName: e.target.value })}
                placeholder="e.g. Apex Local SEO"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Shown prominently in the audit report navbar and footer.
              </p>
            </div>

            {/* Brand Color */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-blue-400" />
                Brand Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.brandColor}
                  onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                  className="h-10 w-14 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={form.brandColor}
                  onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                  placeholder="#2563eb"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Drives buttons, badge highlights, and pitch CTA banners.
              </p>
            </div>

            {/* Logo URL */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                Agency Logo URL
              </label>
              <input
                type="url"
                value={form.agencyLogoUrl}
                onChange={(e) => setForm({ ...form, agencyLogoUrl: e.target.value })}
                placeholder="https://yourdomain.com/logo.png"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Direct link to transparent PNG/SVG logo (approx 180×40px).
              </p>
            </div>

            {/* Booking / Calendar URL */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Booking / Calendar Link (Calendly / Cal.com)
              </label>
              <input
                type="url"
                value={form.bookingUrl}
                onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })}
                placeholder="https://calendly.com/your-agency/seo-strategy"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Powers the high-converting &quot;Book Strategy Call&quot; buttons on the report.
              </p>
            </div>
          </div>

          {/* Agency Website URL */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              Agency Website URL
            </label>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              placeholder="https://youragency.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Live Header Preview */}
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Live Header Preview (As Seen on Pitch Reports)
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {form.agencyLogoUrl ? (
                  <img
                    src={form.agencyLogoUrl}
                    alt={form.agencyName || 'Agency Logo'}
                    className="h-8 max-w-[160px] object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="h-8 px-3 rounded-lg flex items-center justify-center font-bold text-white text-xs tracking-wide"
                    style={{ backgroundColor: form.brandColor || '#2563eb' }}
                  >
                    {form.agencyName || 'Your Agency Name'}
                  </div>
                )}
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                  Verified Local Ranking Audit
                </span>
              </div>

              <div
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 shadow"
                style={{ backgroundColor: form.brandColor || '#2563eb' }}
              >
                <Calendar className="w-3.5 h-3.5" />
                Book Strategy Call
              </div>
            </div>
          </div>

          {/* Messages & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
            <div>
              {success && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Branding settings saved successfully!
                </div>
              )}
              {error && (
                <div className="text-sm text-rose-400 font-semibold">
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: form.brandColor || '#2563eb' }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Settings...
                </>
              ) : (
                'Save Branding Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
