'use client';

import dynamic from 'next/dynamic';

const HeatmapGrid = dynamic(() => import('@/components/HeatmapGrid'), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] w-full animate-pulse rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-sm">
      Loading Interactive Grid Heatmap...
    </div>
  ),
});

export default HeatmapGrid;
