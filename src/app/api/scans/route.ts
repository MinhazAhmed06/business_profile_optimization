import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateGrid, GridShape } from '@/lib/grid';
import { executeParallelScan } from '@/lib/serpEngine';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Serverless function execution timeout configured for parallel scan
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    let resolvedUserId: string | null = null;
    try {
      const authData = await auth();
      resolvedUserId = authData.userId;
    } catch {
      // In local dev without Clerk keys, fallback to local dev user
      resolvedUserId = process.env.DEV_USER_ID || 'user_dev_local';
    }

    const scans = await prisma.scan.findMany({
      where: resolvedUserId ? { userId: resolvedUserId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        results: {
          select: {
            id: true,
            lat: true,
            lng: true,
            rank: true,
            targetName: true,
            placeId: true,
            topResults: true,
          }
        }
      }
    });

    return NextResponse.json({ scans });
  } catch (error: any) {
    logger.error(`Scans GET error: ${error.message}`, 'API');
    return NextResponse.json({ scans: [], error: 'Failed to fetch scans' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let userId: string | null = null;
    let userEmail = 'dev@local.user';
    let userName: string | null = 'Dev User';

    try {
      const authData = await auth();
      userId = authData.userId;
      if (userId) {
        const clerkUser = await currentUser();
        userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@user.local`;
        userName = clerkUser?.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : null;
      }
    } catch {
      // Fallback for dev if Clerk credentials are not configured yet
      userId = process.env.DEV_USER_ID || 'user_dev_local';
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      keyword,
      radius,
      gridSize = 7,
      frequency = 'ONCE',
      businessName,
      placeId,
      websiteUrl,
      shape = 'SQUARE',
      customPoints,
      lat,
      lng
    } = body;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const centerLat = typeof lat === 'number' ? lat : 41.8781;
    const centerLng = typeof lng === 'number' ? lng : -87.6298;
    const parsedRadius = Math.min(Math.max(parseFloat(radius) || 5, 0.5), 100);
    const parsedGridSize = Math.min(Math.max(parseInt(gridSize, 10) || 7, 1), 15);
    const validShapes: GridShape[] = ['SQUARE', 'CIRCLE', 'ZIP', 'SMART'];
    const chosenShape = validShapes.includes(shape as GridShape) ? (shape as GridShape) : 'SQUARE';

    // Auto-provision Clerk user on-the-fly with 150 welcome bonus credits if first scan
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: userEmail,
          name: userName,
          credits: 150,
          creditTransactions: {
            create: {
              amount: 150,
              type: 'SIGNUP_BONUS',
              description: 'Welcome bonus: 150 free grid credits (3 full 7x7 audits)'
            }
          }
        }
      });
    }

    // Generate or use custom points
    const points = customPoints && Array.isArray(customPoints) && customPoints.length > 0
      ? customPoints
      : generateGrid(centerLat, centerLng, parsedRadius, parsedGridSize, chosenShape);

    const requiredCredits = points.length;

    // Atomic row-locked credit deduction + Scan creation
    const scan = await prisma.$transaction(async (tx) => {
      const deducted = await tx.user.updateMany({
        where: {
          id: userId,
          credits: { gte: requiredCredits }
        },
        data: {
          credits: { decrement: requiredCredits }
        }
      });

      if (deducted.count === 0) {
        const current = await tx.user.findUnique({ where: { id: userId }, select: { credits: true } });
        throw new Error(`INSUFFICIENT_CREDITS: Required ${requiredCredits}, available ${current?.credits || 0}`);
      }

      const shareSlug = `audit-${crypto.randomBytes(4).toString('hex')}`;

      const createdScan = await tx.scan.create({
        data: {
          userId,
          keyword: keyword.trim(),
          businessName: businessName?.trim() || null,
          placeId: placeId || null,
          websiteUrl: websiteUrl?.trim() || null,
          centerLat,
          centerLng,
          radius: parsedRadius,
          gridSize: parsedGridSize,
          shape: chosenShape,
          frequency: frequency || 'ONCE',
          customPoints: JSON.stringify(points),
          shareSlug,
          isPublic: true,
          status: 'PENDING'
        }
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -requiredCredits,
          type: 'SCAN_DEDUCTION',
          description: `Grid Scan (${parsedGridSize}x${parsedGridSize}, ${requiredCredits} pins) for "${keyword}"`,
          scanId: createdScan.id
        }
      });

      return createdScan;
    });

    // Execute parallel scan synchronously inside maxDuration=60 (~4-6s execution)
    await executeParallelScan(scan.id);

    const completedScan = await prisma.scan.findUnique({
      where: { id: scan.id },
      include: { results: true }
    });

    return NextResponse.json({
      ...completedScan,
      success: true,
      scan: completedScan
    });

  } catch (error: any) {
    logger.error(`Scan execution failed: ${error.message}`, 'API', { stack: error.stack });
    if (error.message?.includes('INSUFFICIENT_CREDITS')) {
      return NextResponse.json({ error: error.message, code: 'INSUFFICIENT_CREDITS' }, { status: 402 });
    }
    return NextResponse.json({ error: error.message || 'Scan execution failed' }, { status: 500 });
  }
}
