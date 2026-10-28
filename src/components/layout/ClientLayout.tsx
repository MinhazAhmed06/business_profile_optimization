'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { PageTransition } from './PageTransition';
import { UpdateNotifier } from './UpdateNotifier';
import SchedulePoller from '@/components/SchedulePoller';

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isPublicStandalone =
        pathname?.startsWith('/report/') ||
        pathname?.startsWith('/sign-in') ||
        pathname?.startsWith('/sign-up');

    const [collapsed, setCollapsed] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem('sidebar_collapsed');
        if (saved !== null) setCollapsed(JSON.parse(saved));

        // Listen for storage changes to sync across tabs if needed
        const handleStorage = () => {
            const current = localStorage.getItem('sidebar_collapsed');
            if (current !== null) setCollapsed(JSON.parse(current));
        };
        window.addEventListener('storage', handleStorage);

        const handleCollapseChange = (e: any) => {
            setCollapsed(e.detail.collapsed);
        };
        window.addEventListener('sidebar-toggle', handleCollapseChange);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('sidebar-toggle', handleCollapseChange);
        };
    }, []);

    if (isPublicStandalone) {
        return <main className="min-h-screen bg-slate-950">{children}</main>;
    }

    return (
        <div className="flex">
            <Sidebar />
            <main className={`flex-1 transition-all duration-300 ease-in-out ${collapsed ? 'ml-20' : 'ml-64'} min-h-screen p-8`}>
                <PageTransition>
                    {children}
                </PageTransition>

                <footer className="mt-20 py-6 border-t border-gray-200/60 text-center">
                    <p className="text-xs text-gray-400 font-medium">
                        Local SEO Intelligence Platform
                    </p>
                </footer>
            </main>
            <SchedulePoller />
        </div>
    );
}

