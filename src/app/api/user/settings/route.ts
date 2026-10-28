import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

async function getAuthenticatedUserId(): Promise<string> {
  try {
    const authData = await auth();
    if (authData.userId) return authData.userId;
  } catch {
    // Fallback in local dev environment
  }
  return process.env.DEV_USER_ID || 'user_dev_local';
}

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        credits: true,
        plan: true,
        subscriptionStatus: true,
        agencyName: true,
        agencyLogoUrl: true,
        brandColor: true,
        bookingUrl: true,
        websiteUrl: true,
      }
    });

    if (!user) {
      let clerkEmail = `${userId}@user.local`;
      let clerkName: string | null = null;
      try {
        const clerkUser = await currentUser();
        if (clerkUser) {
          clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress || clerkEmail;
          clerkName = clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : null;
        }
      } catch {}

      user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: clerkEmail,
          name: clerkName,
          credits: 150,
          brandColor: '#2563eb',
        },
        select: {
          id: true,
          email: true,
          name: true,
          credits: true,
          plan: true,
          subscriptionStatus: true,
          agencyName: true,
          agencyLogoUrl: true,
          brandColor: true,
          bookingUrl: true,
          websiteUrl: true,
        }
      });
    }

    return NextResponse.json({ user });
  } catch (err: any) {
    logger.error(`User settings GET failed: ${err.message}`, 'API');
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    const body = await req.json();

    const {
      agencyName,
      agencyLogoUrl,
      brandColor,
      bookingUrl,
      websiteUrl,
    } = body;

    // Validate brandColor format if provided
    let safeBrandColor = brandColor ? brandColor.trim() : undefined;
    if (safeBrandColor && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(safeBrandColor)) {
      safeBrandColor = '#2563eb';
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        agencyName: typeof agencyName === 'string' ? agencyName.trim() : undefined,
        agencyLogoUrl: typeof agencyLogoUrl === 'string' ? agencyLogoUrl.trim() : undefined,
        brandColor: safeBrandColor,
        bookingUrl: typeof bookingUrl === 'string' ? bookingUrl.trim() : undefined,
        websiteUrl: typeof websiteUrl === 'string' ? websiteUrl.trim() : undefined,
      },
      select: {
        id: true,
        email: true,
        credits: true,
        plan: true,
        agencyName: true,
        agencyLogoUrl: true,
        brandColor: true,
        bookingUrl: true,
        websiteUrl: true,
      }
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    logger.error(`User settings PATCH failed: ${err.message}`, 'API');
    return NextResponse.json({ error: err.message || 'Failed to update settings' }, { status: 500 });
  }
}
