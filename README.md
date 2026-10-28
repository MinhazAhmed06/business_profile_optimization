# GBP Rank Tracker — Enterprise Google Maps Rank Intelligence & Local SEO SaaS

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

**GBP Rank Tracker** is a commercial-grade, multi-tenant Local SEO intelligence platform and a modern cloud alternative to tools like *Local Falcon* and *BrightLocal*. 

Engineered for local SEO agencies and multi-location enterprises, it executes hyper-local geo-grid ranking scans across Google Maps in **under 5 seconds**, features public white-label audit pitch reports, automated on-page website audits, and an atomic credit-billing system.

---

## ⚡ Key Highlights

- **Sub-5-Second Parallel Scans**: Completely eliminates slow headless browser automation (Playwright/Puppeteer). Grid scans execute concurrently across official SERP APIs (DataForSEO Maps Live API & Serper.dev Places API) using `p-limit(15)` concurrency.
- **Hyper-Local Geo-Grid Tracking**: Configurable 3×3 up to 13×13 square, circle, or custom polygon grids. Computes Average Rank Position (ARP), Average Top-3 Rank Position (ATRP), and Share of Voice (SoV) across the entire service area.
- **Agency White-Label Pitch Reports (`/report/[shareSlug]`)**: Shareable, unauthenticated, client-ready audit reports customized with your agency’s logo, brand colors, booking link (Calendly/Cal.com), and agency name.
- **Automated On-Page Audit & AI Cold Pitch Script**: Auto-discovers the target business's website during the scan, evaluates on-page local SEO vitals (Title, H1, Meta Description, Schema Markup, SSL, Latency), and generates an actionable client outreach pitch.
- **Multi-Tenant Auth & Credit Economy**: Integrated with [Clerk](https://clerk.com) for secure authentication. Features atomic PostgreSQL row locks to prevent credit double-spending, automatic signup bonuses (150 free credits), and full refund protection if coordinate checks fail.
- **Billing & Subscriptions**: Pre-configured webhook listeners for [Dodo Payments](https://dodopayments.com) and [Paddle](https://paddle.com) to automatically refill user credits on recurring subscriptions ($99/mo Pro - 5,000 credits, $149/mo Agency Pro - 15,000 credits).
- **Google Reviews & Sentiment Intelligence**: In-depth review analysis featuring NLP sentiment scoring, velocity tracking, and suspicious/fake review pattern detection.

---

## 🏗️ Architecture

```
                                  ┌────────────────────────┐
                                  │   Clerk Authentication │
                                  └───────────┬────────────┘
                                              │ Session
                                              ▼
┌─────────────────────────┐       ┌────────────────────────┐       ┌─────────────────────────┐
│   Agency Dashboard      ├──────►│  Next.js 16 App Router ├──────►│  PostgreSQL (Prisma)    │
│   & Geo-Grid Heatmap    │       │  API Routes (Node.js)  │       │  Users, Scans, Credits  │
└─────────────────────────┘       └───────────┬────────────┘       └─────────────────────────┘
                                              │
                    ┌─────────────────────────┴────────────────────────┐
                    │                                                  │
                    ▼                                                  ▼
      ┌───────────────────────────┐                      ┌───────────────────────────┐
      │ Parallel SERP Engine      │                      │ Lightweight On-Page Audit │
      │ DataForSEO / Serper API   │                      │ Title, SSL, H1, Schema    │
      │ Concurrency: p-limit(15)  │                      └───────────────────────────┘
      └─────────────┬─────────────┘
                    │
                    ▼
      ┌───────────────────────────┐
      │ Public White-Label Report │
      │ /report/[shareSlug]       │
      │ Live Calendly / Cal.com   │
      └───────────────────────────┘
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: A local PostgreSQL instance or a free cloud database ([Neon](https://neon.tech) / [Supabase](https://supabase.com))
- **Clerk Account**: Free account at [clerk.com](https://clerk.com)
- **SERP API Key**: Account at [DataForSEO](https://dataforseo.com) and/or [Serper.dev](https://serper.dev)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/danishfareed/Google-Maps-SERP.git
cd Google-Maps-SERP
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Open `.env` and configure your credentials:

```env
# Database (PostgreSQL with PgBouncer connection pooling)
DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# SERP Engine
PRIMARY_SERP_PROVIDER="dataforseo" # or "serper"
DATAFORSEO_LOGIN="your-dataforseo-login"
DATAFORSEO_PASSWORD="your-dataforseo-password"
SERPER_API_KEY="your-serper-api-key"
SERP_CONCURRENCY_LIMIT=15

# Subscriptions & Billing (Dodo Payments / Paddle)
DODO_PAYMENTS_WEBHOOK_SECRET="whsec_..."
PADDLE_WEBHOOK_SECRET="pdl_..."
```

### 3. Initialize the Database

Push the schema migrations to your PostgreSQL database and generate the Prisma Client:

```bash
npx prisma migrate deploy
# or for local development:
# npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📦 Production Deployment

The project is optimized for deployment on **Vercel**, **Railway**, or **Render**.

### Deploy to Vercel

1. Push your repository to GitHub / GitLab.
2. Import the project into [Vercel](https://vercel.com).
3. In Project Settings, add all Environment Variables from your `.env` file.
4. Set Build Settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Install Command**: `npm install`
5. Deploy. The `package.json` `postinstall` script will automatically trigger `prisma generate` during deployment.

> **Serverless Execution Buffer**:
> On Vercel Pro or Railway, serverless execution runs comfortably up to 60 seconds (`export const maxDuration = 60`). With `p-limit(15)` parallel batches, a standard 49-point (7×7) grid scan completes in **~3.5 to 5 seconds**.

### Deploy to Railway / Render / Fly.io

Because this is a standard Next.js App Router application without desktop/native dependencies, deploying as a continuous Node service is completely plug-and-play:

```bash
npm run build
npm start
```

---

## ⚙️ Core Modules & API Routes

| Path | Purpose | Access |
|---|---|---|
| `/scans/new` | Configure and trigger a new geo-grid rank scan | Authenticated |
| `/scans/[id]` | Detailed ranking heatmap, competitor breakdown, and export tools | Authenticated |
| `/report/[shareSlug]` | Public, white-labeled client pitch report with calendar CTA | **Public** |
| `/dashboard/settings` | Agency branding customization (logo, brand color, booking URL) | Authenticated |
| `/reviews` | Deep Google Reviews NLP sentiment analysis & fake review detection | Authenticated |
| `/api/scans` | Parallel scan execution with atomic credit deduction & auto-refund | Authenticated |
| `/api/webhooks/billing` | Dodo Payments & Paddle webhook listener for subscription refills | **Public** |
| `/api/user/settings` | Read and update agency white-label configurations | Authenticated |

---

## 🔒 Financial Safety & Credit Accounting

Credit double-spending and runaway SERP costs are prevented through atomic row-level locks:

1. **Atomic Deduction**: When a scan is requested, a PostgreSQL row lock (`tx.user.updateMany({ where: { id: userId, credits: { gte: requiredCredits } } })`) guarantees credits cannot be overdrawn concurrently.
2. **25% Failure Protection**: If more than 25% of coordinates fail during third-party API outages, the scan status marks as `FAILED` and full credits are immediately refunded with an audit log.
3. **Provider Fallback**: If the primary provider (`DataForSEO`) encounters network anomalies, the engine automatically routes coordinate lookups to `Serper.dev` to ensure uninterrupted completion.

---

## 🧪 Testing & Verification

Run the test suite to verify SERP engine fallbacks, On-Page SEO audit parsers, and HMAC webhook security:

```bash
# Verify Type Safety
npx tsc --noEmit

# Run Core System Tests
npx tsx scripts/test-phase1-phase2.ts
npx tsx scripts/test-billing-and-settings.ts

# Test Production Build
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
