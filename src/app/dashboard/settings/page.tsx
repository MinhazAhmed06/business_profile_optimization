import React from 'react';
import WhiteLabelSettingsCard from '@/components/settings/WhiteLabelSettingsCard';

export const dynamic = 'force-dynamic';

export default function DashboardSettingsPage() {
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Agency Settings</h1>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
          Client Pitch Customization & White-Label Controls
        </p>
      </div>

      <WhiteLabelSettingsCard />
    </div>
  );
}
