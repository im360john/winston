# Phase 3: Onboarding & Tenant Dashboard - Progress Report

**Date:** February 11, 2026
**Status:** Foundation Complete ✅ — UI Built, Backend Integration Needed

---

## Executive Summary

Phase 3 foundation has been established! The complete Next.js web application has been built with:

- ✅ Full 7-step onboarding flow (UI complete)
- ✅ Tenant dashboard structure (UI complete)
- ✅ Stripe payment integration (UI ready, backend needed)
- ✅ Landing page with pricing
- ✅ Model selection with credit multiplier display
- ✅ Responsive design with Tailwind CSS

**What's Next:** Backend API endpoints, Stripe webhook handlers, authentication, and testing.

---

## What's Been Built

### 1. Project Structure ✅

```
packages/web/
├── src/
│   ├── app/
│   │   ├── page.tsx                    ✅ Landing page
│   │   ├── login/page.tsx              ✅ Login form
│   │   ├── onboarding/page.tsx         ✅ Onboarding wizard
│   │   ├── dashboard/page.tsx          ✅ Tenant dashboard
│   │   ├── layout.tsx                  ✅ Root layout
│   │   └── globals.css                 ✅ Tailwind styles
│   └── components/
│       └── onboarding/
│           ├── Step1Account.tsx        ✅ Account & payment
│           ├── Step2Website.tsx        ✅ Website analysis
│           ├── Step3Identity.tsx       ✅ Agent identity
│           ├── Step4Capabilities.tsx   ✅ Capabilities
│           ├── Step5Channels.tsx       ✅ Channel setup
│           ├── Step6Connectors.tsx     ✅ Connectors
│           └── Step7Launch.tsx         ✅ Review & launch
├── package.json                        ✅ Dependencies configured
├── tsconfig.json                       ✅ TypeScript config
├── tailwind.config.ts                  ✅ Tailwind config
├── next.config.js                      ✅ Next.js config
└── README.md                           ✅ Documentation
```

### 2. Landing Page ✅

**Features:**
- Hero section with value proposition
- "Get Started Free" and "Sign In" CTAs
- Feature highlights (3 cards)
- Pricing section with 3 tiers:
  - Free: $0/month, 50K credits
  - Starter: $29/month, 500K credits (marked as "Most Popular")
  - Growth: $99/month, 2M credits
- Responsive grid layout
- Winston branding with custom color palette

**File:** `src/app/page.tsx`

### 3. Onboarding Flow ✅

#### Main Wizard (`src/app/onboarding/page.tsx`)
- 7-step progress bar
- State management for onboarding data
- Back/forward navigation
- Step validation

#### Step 1: Account & Payment (`Step1Account.tsx`)
- Email/password signup form
- Tier selection (Free, Starter, Growth)
- Stripe Elements card input
- Payment method validation
- Creates Stripe payment method ID

#### Step 2: Website Analysis (`Step2Website.tsx`)
- Website URL input
- Calls `POST /api/website/analyze`
- Loading state with progress indicators
- Displays analyzed business info:
  - Business name
  - Industry/sub-industry
  - Location and hours
  - Brand color picker (primary, secondary)
- Editable fields for corrections
- Stores suggested capabilities for Step 4

#### Step 3: Agent Identity (`Step3Identity.tsx`)
- Agent name input (pre-filled from website analysis)
- Personality textarea (auto-generated, editable)
- Tone slider: Casual ↔ Professional ↔ Formal
- Live preview of agent greeting

#### Step 4: Business Capabilities (`Step4Capabilities.tsx`)
- Pre-populated capability list from website analysis
- Add/remove capabilities
- Sub-agent suggestion (if 5+ capabilities)
- "Yes, set up both" vs "No, just one agent" choice

#### Step 5: Channels (`Step5Channels.tsx`)
- Toggle switches for each channel:
  - Telegram (with bot token input & setup instructions)
  - Slack (OAuth placeholder)
  - WhatsApp (QR code placeholder)
  - WebChat (auto-enabled)
- Conditional inputs based on selections

#### Step 6: Connectors (`Step6Connectors.tsx`)
- Cannabis POS: Treez, Dutchie, Blaze
- Productivity: Google Calendar, Gmail, Notion, Airtable
- "Connect" buttons (placeholders for modal inputs)
- Read-only vs Read/Write toggle
- "Skip for now" option

#### Step 7: Review & Launch (`Step7Launch.tsx`)
- Summary grid: Agent, Plan, Channels, Capabilities
- AI Model dropdown with credit multipliers:
  - Kimi K2.5 (1.0x) — Recommended
  - Claude Sonnet 4.5 (5.0x)
  - Claude Opus 4.6 (12.0x)
  - GPT-4o (3.0x)
- Credit impact explanation
- Launch progress tracker:
  1. Creating agent
  2. Generating configs
  3. Deploying to Railway
  4. Connecting channels
  5. Agent is live!
- Calls `POST /api/tenants` and `POST /api/tenants/:id/provision`
- Redirects to dashboard with tenant ID

### 4. Tenant Dashboard ✅

**Structure:** Tab-based interface with 6 sections

#### Header
- Agent avatar and name
- Status indicator (● Online)
- Credits display (remaining / total)
- Plan tier
- Settings button

#### Tabs
1. **Chat** - WebChat widget placeholder
2. **History** - Conversation log (placeholder)
3. **Credits** - Usage stats with 3 cards:
   - Remaining credits
   - Used this month
   - Refresh date
4. **Channels** - Connected channel list (Telegram, WebChat)
5. **Connectors** - API integrations (+ Add Connector button)
6. **Settings** - Agent config:
   - Agent name editor
   - AI model selector
   - Billing section with upgrade CTA

**File:** `src/app/dashboard/page.tsx`

### 5. Login Page ✅

- Email/password form
- "Remember me" checkbox
- "Forgot password" link
- "Create a new agent" link to onboarding

**File:** `src/app/login/page.tsx`

### 6. Configuration ✅

- **Tailwind CSS** with custom Winston color palette (green shades)
- **TypeScript** strict mode enabled
- **Next.js 14** with App Router
- **Environment variables** template (`.env.local.example`)
- **Stripe Elements** integrated in Step 1
- **Axios** for API calls
- **SWR** dependency for data fetching (to be implemented)

---

## What Still Needs to Be Done

### 1. Backend API Endpoints ⚠️

**Stripe:**
- [ ] `POST /api/stripe/setup-intent` - Create setup intent
- [ ] `POST /api/stripe/create-customer` - Create Stripe customer
- [ ] `POST /api/stripe/create-subscription` - Start subscription
- [ ] `POST /api/stripe/webhook` - Handle webhooks
- [ ] `PATCH /api/tenants/:id/subscription` - Update subscription

**Credits:**
- [ ] `GET /api/tenants/:id/credits/usage` - Usage history
- [ ] `GET /api/tenants/:id/credits/graph` - Chart data

**Sessions:**
- [ ] `GET /api/tenants/:id/sessions` - List sessions
- [ ] `GET /api/sessions/:sessionId` - Session detail with replay

**Channels:**
- [ ] `POST /api/tenants/:id/channels` - Add channel
- [ ] `DELETE /api/tenants/:id/channels/:channel` - Remove channel
- [ ] `GET /api/tenants/:id/channels/:channel/status` - Health check

**Connectors:**
- [ ] `POST /api/tenants/:id/connectors` - Add connector
- [ ] `PATCH /api/tenants/:id/connectors/:id` - Update credentials
- [ ] `DELETE /api/tenants/:id/connectors/:id` - Remove connector

### 2. Stripe Integration ⚠️

**Setup:**
- [ ] Create products in Stripe dashboard (Free, Starter, Growth)
- [ ] Configure webhook endpoint
- [ ] Test payment flow with test cards
- [ ] Implement subscription lifecycle management

**Database:**
- [x] `stripe_customer_id` column exists ✅
- [x] `stripe_subscription_id` column exists ✅
- [ ] Create `subscription_events` audit table

### 3. Authentication 🔴

- [ ] Choose auth provider (NextAuth.js or Clerk)
- [ ] Implement signup/login flow
- [ ] Session management
- [ ] Protected routes (dashboard requires auth)
- [ ] JWT token handling

### 4. WebChat Widget 🔴

- [ ] Build embeddable React widget
- [ ] Brand color customization
- [ ] Message bubbles UI
- [ ] Typing indicator
- [ ] Connection status
- [ ] Generate unique embed code per tenant
- [ ] CDN hosting setup
- [ ] CORS configuration

### 5. Dashboard Features ⚠️

**Credits Tab:**
- [ ] Usage graph component (Recharts or Chart.js)
- [ ] Credit burn rate calculation
- [ ] Model breakdown chart
- [ ] Low credit warning display

**History Tab:**
- [ ] Session list view
- [ ] Search/filter functionality
- [ ] Session replay component
- [ ] Export conversation feature

**Channels Tab:**
- [ ] Add new channel modal
- [ ] QR code display for WhatsApp
- [ ] Slack OAuth flow
- [ ] Channel health status indicators

**Connectors Tab:**
- [ ] Connector configuration modals
- [ ] API key input (masked display)
- [ ] Read/write toggle with confirmation
- [ ] Test connection button

**Settings Tab:**
- [ ] SOUL.md simplified editor
- [ ] Model switching with impact preview
- [ ] Billing portal integration
- [ ] WebChat embed code display
- [ ] Delete agent confirmation flow

### 6. Testing 🔴

- [ ] End-to-end onboarding flow test
- [ ] Stripe payment capture test
- [ ] Railway provisioning test
- [ ] WebChat widget embed test
- [ ] Model switching test
- [ ] Channel connection test
- [ ] Connector setup test
- [ ] Mobile responsive testing
- [ ] Load test (5 concurrent onboardings)

### 7. Deployment 🔴

- [ ] Deploy to Railway or Vercel
- [ ] Configure production environment variables
- [ ] Set up Stripe production keys
- [ ] Configure webhook endpoints
- [ ] SSL certificate setup
- [ ] Custom domain configuration

---

## Dependencies

### Existing (from Phase 1 & 2)
- ✅ Winston API with `/api/tenants` CRUD
- ✅ Website analyzer endpoint
- ✅ Railway provisioner
- ✅ Config generator
- ✅ LLM Proxy with credit metering
- ✅ PostgreSQL database

### New (Phase 3)
- Stripe account with products configured
- Authentication provider (NextAuth.js or Clerk)
- WebChat widget (can use OpenClaw's built-in widget)
- CDN for widget hosting (Railway Buckets or Cloudflare)

---

## Next Actions (Priority Order)

### Week 1
1. **Set up Stripe** 🔴
   - Create test products (Free, Starter, Growth)
   - Configure webhook endpoint
   - Test payment flow

2. **Implement Authentication** 🔴
   - Choose and integrate auth provider
   - Protect dashboard routes
   - Implement signup/login backend

3. **Build Stripe API Endpoints** ⚠️
   - Setup intent creation
   - Customer creation
   - Subscription management
   - Webhook handler

### Week 2
4. **Build WebChat Widget** 🔴
   - Embeddable React component
   - Brand color customization
   - Generate embed codes

5. **Complete Dashboard Features** ⚠️
   - Credits usage graph
   - Session history viewer
   - Channel management
   - Connector modals

6. **Testing & Deployment** 🔴
   - End-to-end testing
   - Mobile responsive fixes
   - Deploy to production

---

## Success Metrics

When Phase 3 is complete, users should be able to:

- [ ] Sign up and create an account in <2 minutes
- [ ] Analyze their website in <10 seconds
- [ ] Complete full onboarding in <10 minutes
- [ ] Have a live agent on Telegram immediately
- [ ] Chat with their agent via WebChat
- [ ] View credit usage in real-time
- [ ] Add/remove channels without support
- [ ] Add/remove connectors without support
- [ ] Switch AI models and see credit impact
- [ ] Upgrade/downgrade subscription tiers

---

## Technical Debt & Notes

1. **Stripe Integration:** Using Elements for card input, but need to implement full subscription lifecycle (create, update, cancel, webhooks).

2. **Authentication:** Currently no auth implemented. Dashboard is publicly accessible. Need to add session management ASAP.

3. **WebChat Widget:** Decided to use OpenClaw's built-in widget (per decision #3), but need to extract and customize it.

4. **Database Updates:** Stripe columns exist in schema, but need to add `subscription_events` table for audit trail.

5. **Error Handling:** UI has basic error states, but need comprehensive error handling and retry logic for API calls.

6. **Loading States:** Basic spinners implemented, but need skeleton loaders for better UX.

7. **Form Validation:** Basic HTML5 validation in place, need to add client-side validation library (e.g., Zod + react-hook-form).

8. **Accessibility:** No ARIA labels or keyboard navigation implemented yet.

9. **Analytics:** No tracking implemented (consider adding PostHog or Mixpanel).

10. **SEO:** Basic metadata in place, need to add proper OpenGraph tags and sitemap.

---

## Installation Instructions

```bash
# Navigate to web package
cd packages/web

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Edit .env.local with your keys
# - NEXT_PUBLIC_API_URL (winston-api URL)
# - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# - STRIPE_SECRET_KEY

# Start development server
npm run dev

# Visit http://localhost:3000
```

---

## Summary

**Phase 3 Progress: 40% Complete**

✅ **Complete:**
- Next.js app structure
- Full onboarding UI (all 7 steps)
- Tenant dashboard UI (all 6 tabs)
- Landing page with pricing
- Login page
- Stripe Elements integration
- TypeScript + Tailwind setup
- Responsive design

⚠️ **In Progress:**
- Backend API endpoints
- Stripe webhook handlers
- Dashboard data fetching

🔴 **Not Started:**
- Authentication
- WebChat widget
- Session history viewer
- Credit usage graphs
- Connector modals
- Testing & deployment

**Estimated Time to Complete:** 10-12 more days (2 weeks)

---

**Next Step:** Set up Stripe products and implement authentication, then move to backend API endpoints.
