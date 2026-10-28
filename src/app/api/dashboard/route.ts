import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let userId: string | null = null;
        try {
            const authData = await auth();
            userId = authData.userId;
        } catch {
            userId = process.env.DEV_USER_ID || 'user_dev_local';
        }

        const userWhere = userId ? { userId } : {};

        const scansCount = await prisma.scan.count({ where: userWhere });
        const completedScans = await prisma.scan.count({ where: { ...userWhere, status: 'COMPLETED' } });
        const activeScans = await prisma.scan.count({ where: { ...userWhere, status: { in: ['RUNNING', 'PENDING'] } } });
        const recentScans = await prisma.scan.findMany({
            where: userWhere,
            orderBy: { createdAt: 'desc' },
            take: 5,
        });

        return NextResponse.json({ scansCount, completedScans, activeScans, recentScans });
    } catch (error) {
        logger.error('Dashboard API error', 'DASHBOARD', { error: String(error) });
        return NextResponse.json({ scansCount: 0, completedScans: 0, activeScans: 0, recentScans: [], error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}
