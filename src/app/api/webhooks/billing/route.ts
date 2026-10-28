import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

// Disable bodyParser if needed - Next.js App Router route handlers read raw text via req.text()
export const dynamic = 'force-dynamic';

function verifyWebhookSignature(payload: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret) {
    // If webhook secret is not set, log warning in dev/testing and allow processing
    logger.warn('[BillingWebhook] BILLING_WEBHOOK_SECRET is not configured. Skipping signature verification in dev mode.');
    return true;
  }
  if (!signature) return false;

  try {
    // Check Dodo / standard HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    
    // Support either raw hex match or 'sha256=...' prefixed format
    const cleanSig = signature.replace(/^sha256=/, '');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(cleanSig));
  } catch (err: any) {
    logger.error(`[BillingWebhook] Signature verification error: ${err.message}`);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get('webhook-signature') ||
      req.headers.get('x-dodo-signature') ||
      req.headers.get('paddle-signature') ||
      req.headers.get('x-signature');

    const webhookSecret =
      process.env.DODO_PAYMENTS_WEBHOOK_SECRET ||
      process.env.PADDLE_WEBHOOK_SECRET ||
      process.env.BILLING_WEBHOOK_SECRET;

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.error('[BillingWebhook] Invalid webhook signature detected.');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    // Determine event type (Dodo Payments uses 'event_type' or 'type'; Paddle uses 'event_type')
    const eventType = payload.event_type || payload.type || '';
    const data = payload.data || payload;

    logger.info(`[BillingWebhook] Received event: "${eventType}"`, 'BILLING', { eventType });

    // 1. Check for Payment / Subscription Activation Events
    const isPaymentSuccess =
      eventType === 'payment.succeeded' ||
      eventType === 'transaction.completed' ||
      eventType === 'payment_intent.succeeded';

    const isSubscriptionActive =
      eventType === 'subscription.active' ||
      eventType === 'subscription.created' ||
      eventType === 'subscription_created' ||
      eventType === 'subscription.renewed' ||
      eventType === 'subscription_updated';

    const isSubscriptionCancelled =
      eventType === 'subscription.cancelled' ||
      eventType === 'subscription.canceled' ||
      eventType === 'subscription_canceled';

    // 2. Identify the User
    // Check metadata.userId, customer.metadata.userId, customerId, or email
    const metadata = data.metadata || data.custom_data || {};
    const targetUserId =
      metadata.userId ||
      metadata.user_id ||
      data.customer?.metadata?.userId ||
      data.customer?.metadata?.user_id;

    const customerEmail =
      data.customer?.email ||
      data.customer_email ||
      data.email ||
      metadata.email;

    const customerId =
      data.customer_id ||
      data.customer?.id ||
      data.customer?.customer_id;

    const subscriptionId =
      data.subscription_id ||
      data.subscription?.id ||
      data.id;

    // Find user in database
    let user = null;
    if (targetUserId) {
      user = await prisma.user.findUnique({ where: { id: targetUserId } });
    }
    if (!user && customerEmail) {
      user = await prisma.user.findUnique({ where: { email: customerEmail } });
    }
    if (!user && customerId) {
      user = await prisma.user.findFirst({ where: { customerId } });
    }

    if (!user) {
      logger.warn(`[BillingWebhook] Could not locate user for event ${eventType}`, 'BILLING', {
        targetUserId,
        customerEmail,
        customerId
      });
      // Return 200 so provider does not retry endlessly for unmapped user
      return NextResponse.json({ received: true, warning: 'User not found' });
    }

    // 3. Process Active / Succeeded Subscription & Refill Credits
    if (isPaymentSuccess || isSubscriptionActive) {
      // Determine plan tier and credits to grant
      // $99/mo -> Pro (5,000 credits)
      // $149/mo -> Agency Pro (15,000 credits)
      const planName = String(
        metadata.plan ||
        data.product_name ||
        data.plan_id ||
        data.items?.[0]?.price?.name ||
        ''
      ).toLowerCase();

      const amountCents = data.total_amount || data.amount || 0;

      let planTier = 'PRO';
      let creditsToAdd = 5000;

      if (planName.includes('agency') || amountCents >= 14000) {
        planTier = 'AGENCY';
        creditsToAdd = 15000;
      } else if (metadata.creditsAmount) {
        // Custom credit pack purchase
        creditsToAdd = parseInt(metadata.creditsAmount, 10) || 5000;
      }

      // Execute atomic credit refill and subscription status update
      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            credits: { increment: creditsToAdd },
            plan: planTier,
            subscriptionId: subscriptionId ? String(subscriptionId) : undefined,
            customerId: customerId ? String(customerId) : undefined,
            subscriptionStatus: 'ACTIVE',
          }
        }),
        prisma.creditTransaction.create({
          data: {
            userId: user.id,
            amount: creditsToAdd,
            type: 'SUBSCRIPTION_REFILL',
            description: `${planTier} Plan Monthly Refill (+${creditsToAdd.toLocaleString()} credits) - ${eventType}`,
          }
        })
      ]);

      logger.info(
        `[BillingWebhook] Successfully refilled +${creditsToAdd} credits for user ${user.id} (${planTier})`,
        'BILLING'
      );

      return NextResponse.json({
        success: true,
        userId: user.id,
        plan: planTier,
        creditsAdded: creditsToAdd
      });
    }

    // 4. Handle Subscription Cancellation
    if (isSubscriptionCancelled) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: 'CANCELLED',
        }
      });

      logger.info(`[BillingWebhook] Subscription marked CANCELLED for user ${user.id}`, 'BILLING');
      return NextResponse.json({ success: true, userId: user.id, status: 'CANCELLED' });
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    logger.error(`[BillingWebhook] Unexpected error: ${err.message}`, 'BILLING', { stack: err.stack });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
