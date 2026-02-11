# Winston Web App

Next.js web application for Winston platform - tenant onboarding and self-service dashboard.

## Features

### Onboarding Flow (7 Steps)
1. **Account & Payment** - Email/password signup with Stripe payment capture
2. **Website Analysis** - Scrape and analyze tenant website using Claude Sonnet
3. **Agent Identity** - Customize agent name, personality, and tone
4. **Capabilities** - Define what the agent should help with
5. **Channels** - Connect Telegram, Slack, WhatsApp, WebChat
6. **Connectors** - Link business tools (Treez, Dutchie, Google Calendar, etc.)
7. **Review & Launch** - Select AI model and provision agent to Railway

### Tenant Dashboard
- **Chat Tab** - Direct messaging with agent via WebChat
- **History Tab** - Searchable conversation logs
- **Credits Tab** - Usage tracking and billing
- **Channels Tab** - Manage connected messaging platforms
- **Connectors Tab** - Add/remove API integrations
- **Settings Tab** - Agent configuration and account management

## Setup

```bash
cd packages/web
npm install
```

### Environment Variables

Create `.env.local` based on `.env.local.example`:

```bash
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Stripe (use test keys for development)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Development

```bash
npm run dev
```

App will be available at http://localhost:3000

### Build

```bash
npm run build
npm start
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Payments:** Stripe Elements
- **Data Fetching:** SWR + Axios
- **Deployment:** Railway (or Vercel)

## Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Landing page
│   ├── login/page.tsx           # Login page
│   ├── onboarding/page.tsx      # Onboarding wizard
│   ├── dashboard/page.tsx       # Tenant dashboard
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles
├── components/
│   └── onboarding/
│       ├── Step1Account.tsx     # Account & payment
│       ├── Step2Website.tsx     # Website analysis
│       ├── Step3Identity.tsx    # Agent identity
│       ├── Step4Capabilities.tsx # Capabilities
│       ├── Step5Channels.tsx    # Channel setup
│       ├── Step6Connectors.tsx  # Connector integration
│       └── Step7Launch.tsx      # Review & launch
```

## Integration with Winston API

The web app communicates with the Winston API for:

- **Tenant creation:** `POST /api/tenants`
- **Website analysis:** `POST /api/website/analyze`
- **Railway provisioning:** `POST /api/tenants/:id/provision`
- **Credit tracking:** `GET /api/tenants/:id/credits`
- **Session history:** `GET /api/tenants/:id/sessions`

See API documentation at `/packages/api/README.md`

## Stripe Integration

### Test Cards

- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **3D Secure:** 4000 0025 0000 3155

### Webhooks

Set up Stripe webhook endpoint at `/api/stripe/webhook` for:
- `payment_method.attached`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Deployment

### Railway

```bash
# Build and deploy
railway up
```

### Vercel

```bash
# Deploy to Vercel
vercel --prod
```

## Next Steps

- [ ] Implement authentication (NextAuth.js or Clerk)
- [ ] Build WebChat widget component
- [ ] Add session history viewer
- [ ] Implement credit usage graphs
- [ ] Build connector configuration modals
- [ ] Add Stripe subscription management
- [ ] Implement webhook handlers
- [ ] Add mobile responsive design improvements
