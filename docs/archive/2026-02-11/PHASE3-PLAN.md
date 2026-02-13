# Phase 3: Onboarding & Tenant Dashboard

**Goal:** End-to-end onboarding experience and tenant self-service
**Timeline:** Weeks 5-6
**Status:** In Progress

---

## Objectives

Build a complete user-facing web application that allows:
1. New users to onboard and create AI agents in <10 minutes
2. Tenants to self-manage their agents, credits, channels, and connectors
3. Payment capture via Stripe with tier-based pricing
4. Model switching with credit impact visualization

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              winston-web (Next.js)                   │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────────┐  │
│  │  Onboarding App   │    │  Tenant Dashboard     │  │
│  │  (7-step flow)    │    │  (Self-service)       │  │
│  │                   │    │                       │  │
│  │  1. Account & Pay │    │  • Chat with agent    │  │
│  │  2. Website Scan  │    │  • View history       │  │
│  │  3. Agent Identity│    │  • Manage credits     │  │
│  │  4. Capabilities  │    │  • Channel config     │  │
│  │  5. Channels      │    │  • Connector setup    │  │
│  │  6. Connectors    │    │  • Settings & billing │  │
│  │  7. Review/Launch │    │                       │  │
│  └─────────┬────────┘    └──────────┬─────────────┘  │
│            │                        │                │
│            └────────────┬───────────┘                │
│                         │                            │
└─────────────────────────┼────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   winston-api          │
              │                        │
              │   /api/tenants         │
              │   /api/website/analyze │
              │   /api/stripe/*        │
              │   /api/credits         │
              └───────────────────────┘
```

---

## Implementation Checklist

### 1. Next.js Web App Setup ✅ (To Do First)

- [ ] Initialize Next.js 14 app with TypeScript
- [ ] Set up Tailwind CSS for styling
- [ ] Configure app router structure
- [ ] Set up authentication (NextAuth.js or similar)
- [ ] Create shared components library
- [ ] Set up environment variables

### 2. Stripe Integration ✅ (Foundation)

**API Routes:**
- [ ] `POST /api/stripe/setup-intent` - Create setup intent for card capture
- [ ] `POST /api/stripe/create-customer` - Create Stripe customer
- [ ] `POST /api/stripe/create-subscription` - Start subscription
- [ ] `POST /api/stripe/webhook` - Handle Stripe webhooks
- [ ] `POST /api/stripe/update-subscription` - Upgrade/downgrade tier

**Database Updates:**
- [ ] Add `stripe_customer_id` to tenants table (already exists ✅)
- [ ] Add `stripe_subscription_id` to tenants table (already exists ✅)
- [ ] Create `subscription_events` table for audit trail

**Stripe Configuration:**
- [ ] Create product tiers in Stripe dashboard
  - Free tier: $0 (50K credits)
  - Starter tier: $29/month (500K credits)
  - Growth tier: $99/month (2M credits)
- [ ] Configure webhook endpoint
- [ ] Test card capture flow

### 3. Onboarding Flow (7 Steps)

#### Step 1: Account & Payment
- [ ] Email/password signup form
- [ ] Stripe Elements card input
- [ ] Tier selection cards with credit display
- [ ] Create tenant record with status='provisioning'
- [ ] Create Stripe customer

#### Step 2: Website Analysis
- [ ] Website URL input field
- [ ] Call `POST /api/website/analyze` (already exists ✅)
- [ ] Display loading state (<10 second target)
- [ ] Show extracted business info (editable fields)
- [ ] Display detected brand colors

#### Step 3: Agent Identity
- [ ] Agent name input
- [ ] Auto-generated personality textarea (editable)
- [ ] Tone slider (casual ↔ formal)
- [ ] Preview of agent greeting

#### Step 4: Business Questions / Capabilities
- [ ] Display 5 pre-populated questions from website analysis
- [ ] Allow adding/removing questions
- [ ] Sub-agent suggestion logic (if 2+ distinct use cases detected)
- [ ] "Yes, set up both" vs "No, just one agent" choice

#### Step 5: Channels
- [ ] Telegram setup instructions + token input
- [ ] Slack OAuth flow (optional)
- [ ] WhatsApp setup (optional, with warning)
- [ ] WebChat auto-enabled with preview

#### Step 6: Connectors (Optional)
- [ ] Display connector cards for:
  - Treez, Dutchie, Blaze (cannabis POS)
  - Google Calendar, Gmail, Notion, Airtable
- [ ] API key input fields
- [ ] Read-only vs Read/Write toggle
- [ ] "Skip for now" option

#### Step 7: Review & Launch
- [ ] Summary of all settings
- [ ] Model selector dropdown with credit multiplier display
- [ ] "Launch Agent" button
- [ ] Progress indicator:
  1. Creating agent container on Railway
  2. Generating configs
  3. Connecting channels
  4. Agent is live!
- [ ] Redirect to tenant dashboard

### 4. Tenant Dashboard

#### Chat Tab (Default)
- [ ] Embedded WebChat preview
- [ ] Direct messaging with agent
- [ ] Message history display
- [ ] Send message input

#### History Tab
- [ ] Searchable conversation log
- [ ] Date range filter
- [ ] Channel filter (Telegram, Slack, WebChat, etc.)
- [ ] Session details view
- [ ] Export conversation option

#### Credits Tab
- [ ] Current balance display (large, prominent)
- [ ] Monthly allotment
- [ ] Usage graph (last 30 days)
- [ ] Credit burn rate estimate
- [ ] Model breakdown (credits by model)
- [ ] "Upgrade Plan" CTA when low

#### Channels Tab
- [ ] List connected channels with status indicators
- [ ] Add new channel button
- [ ] Channel-specific settings
- [ ] Disconnect/reconnect options
- [ ] QR code display for WhatsApp

#### Connectors Tab
- [ ] List connected APIs with status
- [ ] Add new connector button
- [ ] Edit API key (masked display)
- [ ] Toggle read-only ↔ read/write
- [ ] Revoke connector button

#### Settings Tab
- [ ] Edit agent name
- [ ] Edit personality (simplified SOUL.md editor)
- [ ] Change AI model with credit impact warning
- [ ] Manage billing (upgrade/downgrade tier)
- [ ] WebChat embed code snippet
- [ ] Account settings (email, password)
- [ ] Delete agent (with confirmation)

### 5. WebChat Widget

- [ ] Build embeddable React widget
- [ ] Customize with brand colors from tenant
- [ ] Message bubble styles
- [ ] Typing indicator
- [ ] Connection status indicator
- [ ] Generate unique embed code per tenant
- [ ] CDN hosting for widget.js
- [ ] CORS configuration

### 6. API Endpoints (Additions)

**Stripe:**
- [ ] `POST /api/stripe/setup-intent`
- [ ] `POST /api/stripe/webhook`
- [ ] `PATCH /api/tenants/:id/subscription`

**Credits:**
- [ ] `GET /api/tenants/:id/credits/usage` - Usage history
- [ ] `GET /api/tenants/:id/credits/graph` - Chart data

**Sessions:**
- [ ] `GET /api/tenants/:id/sessions` - List sessions
- [ ] `GET /api/sessions/:sessionId` - Session detail

**Channels:**
- [ ] `POST /api/tenants/:id/channels` - Add channel
- [ ] `DELETE /api/tenants/:id/channels/:channel` - Remove channel
- [ ] `GET /api/tenants/:id/channels/:channel/status` - Health check

**Connectors:**
- [ ] `POST /api/tenants/:id/connectors` - Add connector
- [ ] `PATCH /api/tenants/:id/connectors/:id` - Update credentials
- [ ] `DELETE /api/tenants/:id/connectors/:id` - Remove connector

### 7. Testing & Validation

- [ ] Test full onboarding flow end-to-end
- [ ] Test Stripe payment capture
- [ ] Test agent provisioning (via Railway)
- [ ] Test WebChat widget on external site
- [ ] Test model switching with credit recalculation
- [ ] Test channel connection/disconnection
- [ ] Test connector setup (mock Treez API)
- [ ] Mobile responsive testing
- [ ] Load test with 5 concurrent onboardings

---

## Key Deliverables

1. **Onboarding Web App** - New user can create a live agent in <10 minutes
2. **Tenant Dashboard** - Self-service management of agent, credits, channels, connectors
3. **Stripe Integration** - Payment capture, subscription management, webhooks
4. **WebChat Widget** - Embeddable chat widget with brand customization
5. **Model Switching** - Tenant can change AI model with credit impact display

---

## Technical Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Authentication:** NextAuth.js (or Clerk)
- **Payments:** Stripe (Setup Intents, Subscriptions, Webhooks)
- **State Management:** React Context + SWR for data fetching
- **UI Components:** shadcn/ui or Headless UI
- **Charts:** Recharts or Chart.js for credit usage graphs
- **WebChat:** Custom React widget or OpenClaw's built-in widget

---

## Dependencies on Completed Work

- ✅ Winston API with tenant CRUD (`/api/tenants/*`)
- ✅ Website analyzer (`POST /api/website/analyze`)
- ✅ Railway provisioner (`provisionToRailway()`)
- ✅ Config generator (`generateTenantConfig()`)
- ✅ LLM Proxy with credit metering
- ✅ PostgreSQL database with schema

---

## Timeline Estimate

| Task | Duration |
|------|----------|
| Next.js setup + auth | 1 day |
| Stripe integration | 2 days |
| Onboarding flow (Steps 1-7) | 4 days |
| Tenant dashboard (5 tabs) | 3 days |
| WebChat widget | 2 days |
| Testing & bug fixes | 2 days |
| **Total** | **14 days (2 weeks)** |

---

## Success Criteria

- [ ] New user can complete onboarding in <10 minutes
- [ ] Tenant can chat with their agent via WebChat
- [ ] Tenant can view credit usage and upgrade plan
- [ ] Tenant can add/remove channels without Winston team help
- [ ] Tenant can add/remove connectors without Winston team help
- [ ] Stripe payments are captured successfully
- [ ] WebChat widget works on external websites (Wix, Shopify, etc.)

---

## Notes

- **Website analysis** uses Claude Sonnet for better structured extraction (per decision #4)
- **WebChat widget** will use OpenClaw's built-in widget (per decision #3)
- **Credit refresh** is rolling 30-day from signup date (per decision #3)
- **Skill creation** by agents is allowed; review happens in Phase 4 admin dashboard
- **Connector write access** is self-service via toggle in tenant dashboard

---

## Next Actions

1. Initialize Next.js app structure
2. Set up Stripe test account and configure products
3. Build onboarding Step 1 (account + payment)
4. Build website analysis integration (Step 2)
5. Continue with Steps 3-7
6. Build tenant dashboard shell
7. Implement WebChat widget
