# Winston POC Plan (Archived)

This document was an early planning artifact (February 11, 2026). It is intentionally kept for historical context but is not the operational source of truth.

For current Railway + provisioning behavior, see:
- `docs/RAILWAY.md`
- `CLAUDE.md`

## AI Agent Platform for SMBs — Built on OpenClaw

**Version:** 1.1
**Date:** February 11, 2026
**Status:** POC Planning
**Target:** 20 cannabis dispensary tenants
**Timeline:** 8 weeks

---

## 1. Executive Summary

Winston is a white-labeled, multi-tenant AI agent platform built on top of OpenClaw (open-source, MIT-licensed, self-hosted AI gateway). It enables SMBs — starting with cannabis dispensaries — to deploy personalized AI agents accessible via Telegram, Slack, WhatsApp, and web chat. Winston wraps OpenClaw in a managed SaaS layer with onboarding, billing, credit metering, tenant management, and operational tooling.



### Core Architecture Principle

**Wrap, don't fork.** OpenClaw runs unmodified inside Docker containers. All Winston-specific logic lives in surrounding services: a provisioning layer, an LLM API proxy for metering, a management dashboard, and a Postgres database for auditability. This allows tracking upstream OpenClaw updates without maintaining a hard fork.

---

## 2. User Journey Stories

### 2.1 Tenant Journey: "Maria, Dispensary Owner"

Maria owns Green Leaf Dispensary in Oakland, CA. She runs a Treez-powered POS across two locations and has 4 budtenders on staff. She's heard about AI assistants and wants one for her shop but doesn't have technical staff.

**Discovery & Signup (Day 0, 8 minutes)**
Maria finds Winston through a Treez partner email. She clicks the link and lands on the Winston onboarding page. She enters her email, creates a password, and adds her credit card (she picks the free tier to try it out). She types in her website URL: `www.greenleafoakland.com`.

While she waits for about 5 seconds, Winston scrapes her site. When the next screen loads, she sees her dispensary's name, her brand colors (forest green and cream), and a suggested agent name: "Sage." The form already knows she's a cannabis retailer and has pre-filled five business questions she might want help with: "Check product inventory levels," "Answer customer strain questions," "Summarize daily sales," "Look up loyalty points for a customer," and "Track vendor delivery schedules." She edits one — changing "vendor delivery" to "help me write social media posts about new products" — and moves on.

She names her agent "Bud" instead of "Sage," tweaks the personality description to say "friendly but not too casual," and hits next. The channel screen shows Telegram pre-selected with clear instructions: open Telegram, search for @BotFather, send `/newbot`, copy the token. She does this on her phone in 90 seconds and pastes the token. She also toggles on WebChat since she has a Wix website and wants a chat widget.

She skips the Connectors step for now (she doesn't have her Treez API key handy). She hits "Launch Agent" and watches a progress bar: "Creating Bud... Teaching Bud about Green Leaf... Connecting to Telegram... Done!" She's redirected to her dashboard where Bud is live. She opens Telegram on her phone and sends "Hey Bud, what can you do?" — and gets a personalized response.

**First Week (Days 1-7)**
Maria messages Bud throughout the week. She asks it to help write an Instagram caption for a new strain arrival. She asks what the most popular strains are (Bud apologizes that it doesn't have POS data connected yet and suggests she add the Treez connector). She asks Bud to remind her to order more pre-rolls on Friday — Bud notes it in memory.

On Day 4, she goes to her dashboard and adds her Treez API key under Connectors. Now when she asks "what's my Blue Dream inventory looking like?" Bud pulls real data. She tells her budtender team about the Telegram bot and they start using it too for quick inventory checks.

On Day 6, she gets a gentle message from Bud: "Hey! I've used about 80% of my thinking credits this month. Things are going great — if you want to keep our conversations flowing without interruption, you can upgrade at [link]. Otherwise, I'll refresh on the 15th!" She upgrades to Starter ($29/month).

**Ongoing (Month 2+)**
Maria now considers Bud part of her operations. She's added Slack as a channel for her team and keeps Telegram for herself. She's asked Bud to create a custom skill for generating weekly sales summaries. Bud built it and now runs it every Monday morning. She occasionally checks her dashboard to see credit usage and conversation history.

---

### 2.2 Tenant Journey: "Derek, Multi-Location Operator"

Derek operates 6 dispensary locations under the "Canopy" brand across Colorado. He has an IT manager (Alex) who handles tech. Derek wants AI agents for customer-facing chat on their website and internal operations Slack.

**Setup (Day 0, 20 minutes)**
Alex handles the Winston onboarding. He sets up the main org, picks Growth tier ($99/month). During onboarding, the business questions reveal two distinct use cases: customer Q&A and internal operations reporting. Winston suggests configuring two sub-agents: "Canopy Concierge" (customer-facing, WebChat, read-only) and "Canopy Ops" (internal, Slack, with Treez API write access for inventory adjustments).

Alex connects Treez, Dutchie (they use both), and Slack. He configures WebChat and embeds the widget snippet on their Shopify site. Both agents are live within 20 minutes.

**Ongoing**
Derek's team uses Canopy Ops daily for inventory checks across all 6 locations, pulling data through the Treez API. Canopy Concierge handles ~50 customer questions per day on the website about product availability, store hours, and strain effects. Alex monitors usage through the tenant dashboard and adjusts the agent personalities quarterly based on customer feedback.

---

### 2.3 Winston Team Journey: "Priya, Winston Operations Lead"

Priya manages the Winston platform from the operational side. She's responsible for keeping tenants happy, monitoring system health, and handling escalations.

**Morning Routine (Daily, 15 minutes)**
Priya opens the Winston Admin Dashboard. The tenant overview shows 18 of 20 tenants green (healthy), 1 yellow (WhatsApp session disconnected for "Herbology Hub" at 3am), and 1 red ("Elevation" agent hasn't responded to any messages in 12 hours).

She clicks into the yellow tenant. The health panel shows WhatsApp disconnected at 3:17am. She checks the audit log — no config changes, likely WhatsApp's standard session drop. She clicks "Notify Tenant" which sends an automated email: "Your WhatsApp channel needs reconnection. Here's how to re-scan the QR code..." She makes a note to prioritize Telegram adoption in onboarding to reduce these incidents.

For the red tenant, she opens the session replay view. She scrolls through the last 24 hours of conversations and sees the agent started returning credit exhaustion messages yesterday afternoon. The tenant is on the free tier and burned through credits quickly because their agent was creating skills (token-heavy). She checks the credit log — they hit 0 at 4pm yesterday. She has two options: send an upgrade nudge email, or grant a temporary credit boost. She grants 10,000 bonus credits and flags the tenant for a check-in call.

**Weekly Tasks**
- Review the skills management panel. Two tenants' agents have auto-created new skills this week. She reviews the SKILL.md files for anything concerning (security, scope creep) and approves them.
- Push a baseline config update: the Winston team decided to bump the default context overflow threshold from 40K to 60K tokens. She uses the "Push Config Update" tool which merges the change into all 20 tenant configs and restarts their gateways in a rolling fashion.
- Run backup snapshots for all tenants. The system does this automatically nightly, but she triggers a manual one before a planned OpenClaw version upgrade.

**Incident Response**
A tenant messages support saying their agent "forgot everything." Priya opens the session replay and sees the agent's memory files are intact but the session compacted aggressively due to a long conversation. She checks the config — the compaction threshold was set too low. She adjusts it, restarts the gateway, and the agent's next response picks up context from memory files. She updates the baseline config to prevent this for other tenants.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     WINSTON PLATFORM                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Onboarding   │  │  Management  │  │  Billing/Credits │  │
│  │  Web App      │  │  Dashboard   │  │  (Stripe)        │  │
│  │  (Next.js)    │  │  (Next.js)   │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │            │
│  ┌──────┴──────────────────┴────────────────────┴────────┐  │
│  │              Winston API Service (Node.js)             │  │
│  │  - Tenant provisioning (CRUD)                         │  │
│  │  - Config generation (openclaw.json, SOUL.md, etc.)   │  │
│  │  - Credit metering & enforcement                       │  │
│  │  - Session log ingestion                               │  │
│  │  - Health monitoring                                   │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────────────┐  │
│  │          LLM Proxy Service (Node.js) *** CRITICAL ***  │  │
│  │                                                        │  │
│  │  All tenant LLM traffic routes through this proxy.     │  │
│  │  No tenant container talks directly to any LLM API.    │  │
│  │                                                        │  │
│  │  Responsibilities:                                     │  │
│  │  - Intercepts all LLM API calls from tenant containers │  │
│  │  - Routes to correct provider based on tenant's        │  │
│  │    selected model (Kimi K2.5, Claude Sonnet, etc.)     │  │
│  │  - Holds the REAL API keys for all LLM providers       │  │
│  │    (Moonshot, Anthropic, OpenAI, etc.)                 │  │
│  │  - Token counting & credit deduction per tenant        │  │
│  │  - Credit balance enforcement:                         │  │
│  │    > 80% remaining: normal passthrough                 │  │
│  │    > 20% remaining: inject warning header              │  │
│  │    > 0% remaining: return graceful exhaustion response │  │
│  │  - No rate limiting (per decision)                     │  │
│  │  - Audit logging of all LLM interactions               │  │
│  │  - Model-aware credit calculation (different models     │  │
│  │    burn credits at different rates)                     │  │
│  │                                                        │  │
│  │  WHY A PROXY:                                          │  │
│  │  - Anthropic has no programmatic key creation API      │  │
│  │  - Moonshot has no programmatic key creation API       │  │
│  │  - Centralizes all LLM spend under Winston's accounts  │  │
│  │  - Enables model switching without container restarts  │  │
│  │  - Single point for metering, billing, and audit       │  │
│  │  - Tenant containers never see real API keys           │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────────────┐  │
│  │                  PostgreSQL Database                    │  │
│  │  - Tenant records & config snapshots                   │  │
│  │  - Credit balances & usage history                     │  │
│  │  - Session transcripts (synced from containers)        │  │
│  │  - Audit logs                                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Tenant Containers (Railway)                  │  │
│  │                                                        │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐    ┌─────────┐ │  │
│  │  │Tenant 1 │ │Tenant 2 │ │Tenant 3 │ ...│Tenant N │ │  │
│  │  │OpenClaw │ │OpenClaw │ │OpenClaw │    │OpenClaw │ │  │
│  │  │Gateway  │ │Gateway  │ │Gateway  │    │Gateway  │ │  │
│  │  └─────────┘ └─────────┘ └─────────┘    └─────────┘ │  │
│  │  Each container has:                                   │  │
│  │  - openclaw.json (generated by provisioner)            │  │
│  │  - SOUL.md, AGENTS.md, USER.md (generated)            │  │
│  │  - Skills directory (curated by Winston + agent-made)  │  │
│  │  - Railway Volume for persistence                      │  │
│  │  - Sealed env vars for secrets                         │  │
│  │  - Sidecar: log tail → Postgres                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 LLM Proxy — Detailed Request Flow

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│ Tenant        │     │   LLM Proxy        │     │  LLM Provider    │
│ Container     │     │                    │     │  (Moonshot/       │
│ (OpenClaw)    │     │                    │     │   Anthropic/etc)  │
└──────┬───────┘     └─────────┬──────────┘     └────────┬─────────┘
       │                       │                          │
       │ POST /v1/messages     │                          │
       │ Auth: winston-{tid}   │                          │
       │──────────────────────>│                          │
       │                       │                          │
       │                       │ 1. Parse tenant ID       │
       │                       │ 2. Lookup tenant model   │
       │                       │    selection in cache     │
       │                       │ 3. Check credit balance   │
       │                       │                          │
       │                       │ [IF credits > 0]         │
       │                       │                          │
       │                       │ 4. Rewrite request:      │
       │                       │    - Swap model ID to    │
       │                       │      provider's format   │
       │                       │    - Swap API key to     │
       │                       │      real provider key   │
       │                       │    - Route to correct    │
       │                       │      provider baseUrl    │
       │                       │                          │
       │                       │ POST /v1/messages        │
       │                       │ Auth: sk-real-key        │
       │                       │─────────────────────────>│
       │                       │                          │
       │                       │         200 OK           │
       │                       │<─────────────────────────│
       │                       │                          │
       │                       │ 5. Extract token counts  │
       │                       │    from response metadata │
       │                       │ 6. Calculate credits:     │
       │                       │    tokens × model_rate   │
       │                       │ 7. Deduct from balance   │
       │                       │ 8. Log to audit table    │
       │                       │ 9. Inject credit headers │
       │                       │                          │
       │     200 OK            │                          │
       │  + X-Winston-Credits  │                          │
       │<──────────────────────│                          │
       │                       │                          │
       │                       │ [IF credits <= 0]        │
       │                       │                          │
       │     402 Payment Req.  │                          │
       │  {winston_credits_    │                          │
       │   exhausted}          │                          │
       │<──────────────────────│                          │
```

**Multi-Model Routing Table (in proxy):**

| Model Selection | Provider | Base URL | Real API Key | Credit Multiplier |
|----------------|----------|----------|-------------|-------------------|
| `kimi-k2.5` (default) | Moonshot | `https://api.moonshot.ai/v1` | `sk-moonshot-xxx` | 1.0x |
| `kimi-k2.5` via OpenRouter | OpenRouter | `https://openrouter.ai/api/v1` | `sk-or-xxx` | 1.0x |
| `claude-sonnet-4-5` | Anthropic | `https://api.anthropic.com/v1` | `sk-ant-xxx` | 5.0x |
| `claude-opus-4-6` | Anthropic | `https://api.anthropic.com/v1` | `sk-ant-xxx` | 12.0x |
| `gpt-4o` | OpenAI | `https://api.openai.com/v1` | `sk-openai-xxx` | 3.0x |

The credit multiplier means: if Kimi K2.5 costs 1 credit per 1,000 tokens, Claude Sonnet costs 5 credits for the same tokens. This is reflected in the tenant dashboard so they understand the tradeoff.

---

## 4. UI/UX Flows

### 4.1 Tenant Onboarding Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ONBOARDING WEB APP                        │
│                                                              │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐ │
│  │  STEP 1  │──>│  STEP 2   │──>│  STEP 3   │──>│  STEP 4  │ │
│  │ Account  │   │ Website   │   │ Agent     │   │ Business │ │
│  │ & Pay    │   │ Analysis  │   │ Identity  │   │ Questions│ │
│  └─────────┘   └──────────┘   └──────────┘   └──────────┘ │
│       │              │              │               │        │
│       ▼              ▼              ▼               ▼        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌────────┐ │
│  │  STEP 5   │──>│  STEP 6  │──>│  STEP 7      │──>│ LAUNCH │ │
│  │ Channels  │  │Connectors│  │ Review &     │  │        │ │
│  │           │  │(Optional)│  │ Confirm      │  │        │ │
│  └──────────┘  └──────────┘  └──────────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Screen: Step 1 — Account & Payment

```
┌──────────────────────────────────────────────────┐
│  [Winston Logo]                                   │
│                                                   │
│  Create Your AI Agent                             │
│  ─────────────────                                │
│                                                   │
│  Email         [_______________________________]  │
│  Password      [_______________________________]  │
│                                                   │
│  Choose your plan:                                │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │    FREE      │ │  STARTER    │ │   GROWTH   │ │
│  │              │ │             │ │            │ │
│  │  50K credits │ │ 500K credits│ │ 2M credits │ │
│  │  ~150 chats  │ │ ~1,500 chats│ │~6,000 chats│ │
│  │              │ │             │ │            │ │
│  │  $0/month    │ │  $29/month  │ │ $99/month  │ │
│  │              │ │             │ │            │ │
│  │ [Selected]   │ │ [Select]    │ │ [Select]   │ │
│  └─────────────┘ └─────────────┘ └────────────┘ │
│                                                   │
│  Card required for all plans (prevents bot abuse) │
│  Card: [____ ____ ____ ____]  Exp [__/__] CVC [_] │
│                                                   │
│                              [Continue →]         │
│                                                   │
│  Powered by Stripe                                │
└──────────────────────────────────────────────────┘
```

#### Screen: Step 2 — Website Analysis

```
┌──────────────────────────────────────────────────┐
│  Step 2 of 7                    [← Back]          │
│                                                   │
│  Let's learn about your business                  │
│  ───────────────────────────────                  │
│                                                   │
│  Enter your website URL:                          │
│  [https://www.greenleafoakland.com_____________]  │
│                                                   │
│           [Analyze My Site →]                     │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  ✓ Found your site                        │    │
│  │  ✓ Identified: Cannabis Dispensary         │    │
│  │  ✓ Detected brand colors                  │    │
│  │  ✓ Extracted business info                 │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  We detected:                                     │
│  Business Name:  [Green Leaf Dispensary________]  │
│  Industry:       [Cannabis Retail______________]  │
│  Location:       [Oakland, CA_________________]  │
│  Hours:          [9am-9pm daily_______________]   │
│                                                   │
│  Brand Colors:                                    │
│  Primary   [■ #2D5A27] Secondary [■ #F5F0E8]     │
│  Accent    [■ #8B6914]                            │
│                                                   │
│  Edit any field if we got something wrong.        │
│                                                   │
│                              [Continue →]         │
└──────────────────────────────────────────────────┘
```

#### Screen: Step 3 — Agent Identity

```
┌──────────────────────────────────────────────────┐
│  Step 3 of 7                    [← Back]          │
│                                                   │
│  Name & personalize your agent                    │
│  ─────────────────────────────                    │
│                                                   │
│  Agent Name:                                      │
│  [Bud_________________________________________]   │
│  This is what your customers and team will call   │
│  your agent.                                      │
│                                                   │
│  Agent Personality:                               │
│  ┌──────────────────────────────────────────┐    │
│  │ You are Bud, a friendly and              │    │
│  │ knowledgeable assistant for Green Leaf   │    │
│  │ Dispensary. You help customers and staff  │    │
│  │ with product information, inventory       │    │
│  │ questions, and store policies. You        │    │
│  │ communicate in a warm, approachable tone  │    │
│  │ that reflects the Green Leaf brand.       │    │
│  └──────────────────────────────────────────┘    │
│  ↑ Auto-generated from your website. Edit freely. │
│                                                   │
│  Tone:  [Casual ●───────○──── Formal]             │
│                                                   │
│                              [Continue →]         │
└──────────────────────────────────────────────────┘
```

#### Screen: Step 4 — Business Questions

```
┌──────────────────────────────────────────────────┐
│  Step 4 of 7                    [← Back]          │
│                                                   │
│  What should your agent help with?                │
│  ─────────────────────────────────                │
│                                                   │
│  We've suggested some based on your business.     │
│  Edit, remove, or add your own.                   │
│                                                   │
│  1. [Check product inventory levels_________] [×] │
│  2. [Answer customer strain questions_______] [×] │
│  3. [Summarize daily sales performance______] [×] │
│  4. [Look up customer loyalty points________] [×] │
│  5. [Help write social media posts__________] [×] │
│                                                   │
│  [+ Add another question]                         │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │ 💡 Based on your answers, we recommend    │    │
│  │ setting up TWO agents:                    │    │
│  │                                           │    │
│  │ • "Bud" — customer-facing (WebChat)       │    │
│  │   Handles questions 1, 2, 4               │    │
│  │                                           │    │
│  │ • "Bud Ops" — internal team (Telegram)    │    │
│  │   Handles questions 3, 5                  │    │
│  │                                           │    │
│  │ [Yes, set up both] [No, just one agent]   │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│                              [Continue →]         │
└──────────────────────────────────────────────────┘
```

#### Screen: Step 5 — Channels

```
┌──────────────────────────────────────────────────┐
│  Step 5 of 7                    [← Back]          │
│                                                   │
│  Where should your agent be available?            │
│  ─────────────────────────────────────            │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │ ✓ TELEGRAM  (Recommended — easiest setup) │    │
│  │                                           │    │
│  │ Quick setup — takes 90 seconds:           │    │
│  │ 1. Open Telegram, search @BotFather       │    │
│  │ 2. Send: /newbot                          │    │
│  │ 3. Follow prompts to name your bot        │    │
│  │ 4. Copy the token and paste below         │    │
│  │                                           │    │
│  │ Bot Token:                                │    │
│  │ [110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5P]  │    │
│  │                                    ✓ Valid │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │ ☐ SLACK                                   │    │
│  │   [Connect Slack Workspace →]             │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │ ☐ WHATSAPP                                │    │
│  │   ⚠ Requires periodic re-authentication  │    │
│  │   [Set up WhatsApp →]                     │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │ ✓ WEBCHAT  (auto-enabled)                 │    │
│  │   Embed code will be provided after setup │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│                              [Continue →]         │
└──────────────────────────────────────────────────┘
```

#### Screen: Step 6 — Connectors (Optional)

```
┌──────────────────────────────────────────────────┐
│  Step 6 of 7                    [← Back]          │
│                                                   │
│  Connect your tools (optional — do this later)    │
│  ──────────────────────────────────────────────   │
│                                                   │
│  Connecting your business tools lets your agent   │
│  access real data. All connections are READ-ONLY  │
│  by default.                                      │
│                                                   │
│  Cannabis POS Systems:                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │   Treez     │ │   Dutchie   │ │   Blaze    │   │
│  │  [Connect]  │ │  [Connect]  │ │  [Connect] │   │
│  └────────────┘ └────────────┘ └────────────┘   │
│                                                   │
│  When you click Connect:                          │
│  ┌──────────────────────────────────────────┐    │
│  │ Treez API Key:                            │    │
│  │ [______________________________________]  │    │
│  │                                           │    │
│  │ Access Level:                             │    │
│  │ ● Read-only (recommended)                 │    │
│  │ ○ Read & Write                            │    │
│  │                                           │    │
│  │          [Save Connection]                │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  Other Tools:                                     │
│  Google Calendar · Gmail · Notion · Airtable      │
│                                                   │
│             [Skip for now]   [Continue →]         │
└──────────────────────────────────────────────────┘
```

#### Screen: Step 7 — Review & Launch

```
┌──────────────────────────────────────────────────┐
│  Step 7 of 7                    [← Back]          │
│                                                   │
│  Review & Launch                                  │
│  ───────────────                                  │
│                                                   │
│  Agent: Bud                                       │
│  Business: Green Leaf Dispensary                   │
│  Plan: Free (50K credits/month)                   │
│                                                   │
│  Channels: Telegram ✓  WebChat ✓                  │
│  Connectors: None (add later from dashboard)      │
│                                                   │
│  Personality: "Friendly, knowledgeable cannabis    │
│  retail assistant..."                              │
│                                                   │
│  AI Model: Kimi K2.5 (best value)                 │
│  [Change model ▾]                                 │
│  ┌──────────────────────────────────────────┐    │
│  │ ● Kimi K2.5 — 1x credits (recommended)   │    │
│  │ ○ Claude Sonnet 4.5 — 5x credits         │    │
│  │ ○ Claude Opus 4.6 — 12x credits          │    │
│  │ ○ GPT-4o — 3x credits                    │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│           [ 🚀 Launch Bud ]                       │
│                                                   │
│  ┌──────────────────────────────────────────┐    │
│  │  ⟳ Creating Bud...                        │    │
│  │  ✓ Teaching Bud about Green Leaf...       │    │
│  │  ✓ Connecting Telegram...                 │    │
│  │  ✓ Setting up WebChat...                  │    │
│  │  ✓ Bud is live!                           │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

---

### 4.2 Tenant Dashboard UI

```
┌──────────────────────────────────────────────────────────────┐
│  [Agent Avatar] Bud — Green Leaf Dispensary    [Settings ⚙]  │
│  Status: ● Online    Credits: 38,200 / 50,000    Plan: Free │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│  Chat    │ History  │ Credits  │ Channels │ Connectors      │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│                                                              │
│  [CHAT TAB - default view]                                   │
│  ┌──────────────────────────────────────────────────┐       │
│  │  WebChat Preview — Talk to Bud                    │       │
│  │  ┌──────────────────────────────────────┐        │       │
│  │  │ Bud: Hey! I'm Bud, your assistant   │        │       │
│  │  │ for Green Leaf. What can I help with? │        │       │
│  │  │                                      │        │       │
│  │  │ You: What's our Blue Dream stock?    │        │       │
│  │  │                                      │        │       │
│  │  │ Bud: Currently we have 24 units of   │        │       │
│  │  │ Blue Dream in stock at the Oakland   │        │       │
│  │  │ location. That's down from 36 last   │        │       │
│  │  │ week — might want to reorder soon.   │        │       │
│  │  └──────────────────────────────────────┘        │       │
│  │  [Type a message..._______________] [Send]        │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  [HISTORY TAB]                                               │
│  Searchable conversation log with date/channel filters       │
│                                                              │
│  [CREDITS TAB]                                               │
│  Usage graph, credit burn rate, model breakdown, upgrade CTA │
│                                                              │
│  [CHANNELS TAB]                                              │
│  Manage connected channels, add new, view status             │
│  Telegram: ● Connected    WebChat: ● Active                  │
│  [+ Add Channel]                                             │
│                                                              │
│  [CONNECTORS TAB]                                            │
│  Manage API keys, toggle read/write, add new connectors      │
│  Treez: ● Connected (Read-only)   [Edit] [Revoke]           │
│  [+ Add Connector]                                           │
│                                                              │
│  [SETTINGS]                                                  │
│  Edit agent personality (SOUL.md simplified editor)          │
│  Change AI model (with credit multiplier display)            │
│  Agent name and identity                                     │
│  Manage billing / upgrade plan                               │
│  WebChat embed code                                          │
└──────────────────────────────────────────────────────────────┘
```

---

### 4.3 Winston Admin Dashboard UI

```
┌──────────────────────────────────────────────────────────────┐
│  WINSTON ADMIN                          [Priya ▾] [Logout]   │
├───────────┬──────────────────────────────────────────────────┤
│           │                                                   │
│  SIDEBAR  │  TENANT OVERVIEW                                  │
│           │  ───────────────                                  │
│ Dashboard │  18 Active  1 Warning  1 Critical  0 Paused      │
│ Tenants   │                                                   │
│ Sessions  │  ┌────────────────────────────────────────────┐  │
│ Skills    │  │ Tenant          Status  Credits  Channels   │  │
│ Config    │  │ ──────────────  ──────  ───────  ────────   │  │
│ Health    │  │ Green Leaf      ● OK    38.2K    TG, Web    │  │
│ Backups   │  │ Canopy          ● OK    1.8M     Slack,Web  │  │
│ Logs      │  │ Herbology Hub   ◐ WARN  45.1K    WA↓, TG   │  │
│           │  │ Elevation       ● CRIT  0        TG         │  │
│           │  │ ...                                          │  │
│           │  └────────────────────────────────────────────┘  │
│           │                                                   │
│           │  HEALTH ALERTS                                    │
│           │  ┌────────────────────────────────────────────┐  │
│           │  │ ⚠ Herbology Hub: WhatsApp disconnected     │  │
│           │  │   Since: 3:17am  [Notify Tenant] [Details] │  │
│           │  │                                             │  │
│           │  │ 🔴 Elevation: Credits exhausted             │  │
│           │  │   Since: 4:02pm yesterday                   │  │
│           │  │   [Grant Credits] [Notify] [Details]        │  │
│           │  └────────────────────────────────────────────┘  │
│           │                                                   │
├───────────┼──────────────────────────────────────────────────┤
│           │                                                   │
│  TENANT   │  TENANT DETAIL: Green Leaf Dispensary             │
│  DETAIL   │  ──────────────────────────────────               │
│  VIEW     │                                                   │
│           │  Config  Sessions  Credits  Health  Backup        │
│           │                                                   │
│           │  [CONFIG TAB]                                     │
│           │  openclaw.json    v3  [View] [Edit] [Diff]       │
│           │  SOUL.md          v2  [View] [Edit] [Diff]       │
│           │  AGENTS.md        v1  [View] [Edit]              │
│           │  Skills (4 installed)  [Manage]                   │
│           │                                                   │
│           │  [Push Config Update to This Tenant]              │
│           │                                                   │
│           │  [SESSIONS TAB]                                   │
│           │  ┌──────────────────────────────────────────┐    │
│           │  │ Session: abc-123  Channel: Telegram       │    │
│           │  │ Started: Feb 10, 2:15pm  Turns: 14       │    │
│           │  │ Tokens: 12,340  Credits: 12.3             │    │
│           │  │                                           │    │
│           │  │ [▶ Replay Conversation]                   │    │
│           │  │                                           │    │
│           │  │ User: What's our Blue Dream stock?        │    │
│           │  │ Agent: Currently we have 24 units...      │    │
│           │  │ [Tool Call: treez-inventory-lookup]        │    │
│           │  │ User: Order 50 more from the usual vendor │    │
│           │  │ Agent: I've noted that. Since I'm in      │    │
│           │  │   read-only mode, I can't place orders... │    │
│           │  └──────────────────────────────────────────┘    │
│           │                                                   │
│           │  [BACKUP TAB]                                     │
│           │  Last backup: Feb 11, 3:00am (automatic)         │
│           │  [Backup Now] [Restore from Backup ▾] [Export]   │
│           │                                                   │
├───────────┼──────────────────────────────────────────────────┤
│           │                                                   │
│  GLOBAL   │  PUSH BASELINE CONFIG UPDATE                      │
│  CONFIG   │  ──────────────────────────                       │
│           │                                                   │
│           │  Current baseline: v1.2                           │
│           │  Pending changes:                                 │
│           │  • Context overflow threshold: 40K → 60K         │
│           │  • Added web_search to default tool allow list   │
│           │                                                   │
│           │  Affected tenants: 20 / 20                        │
│           │  Tenant overrides preserved: Yes                  │
│           │                                                   │
│           │  [Preview Merge for Each Tenant]                  │
│           │  [Push to All Tenants (Rolling Restart)]          │
│           │                                                   │
├───────────┼──────────────────────────────────────────────────┤
│           │                                                   │
│  SKILLS   │  SKILLS MANAGEMENT                                │
│  MGMT     │  ─────────────────                                │
│           │                                                   │
│           │  Curated Library (8 skills)                        │
│           │  ✓ inventory-lookup  ✓ sales-summary              │
│           │  ✓ loyalty-lookup    ✓ web-search                 │
│           │  ✓ social-media      ✓ calendar                   │
│           │  ✓ email-draft       ✓ daily-report               │
│           │                                                   │
│           │  Agent-Created Skills (review queue)              │
│           │  ┌──────────────────────────────────────────┐    │
│           │  │ "weekly-sales-report" by Green Leaf       │    │
│           │  │ Created: Feb 9  [View SKILL.md] [Approve] │    │
│           │  │                                           │    │
│           │  │ "strain-comparison" by Canopy             │    │
│           │  │ Created: Feb 10 [View SKILL.md] [Approve] │    │
│           │  └──────────────────────────────────────────┘    │
│           │                                                   │
│           │  [Push Skill to All Tenants]                      │
└───────────┴──────────────────────────────────────────────────┘
```

---

## 5. Infrastructure

### 5.1 Platform: Railway

Railway is the deployment target for the POC. Rationale:
- OpenClaw Railway templates already exist and are production-tested
- Persistent volumes survive redeploys
- Built-in logging, env var management, sealed variables for secrets
- Usage-based pricing fits POC economics
- Railway API enables programmatic service creation for tenant provisioning

### 5.2 Estimated Cost (20 tenants)

| Component | Monthly Cost |
|-----------|-------------|
| 20 tenant containers (~$5-7/ea at low utilization) | $100-140 |
| Winston API service | $10-15 |
| LLM Proxy service | $10-15 |
| PostgreSQL (Railway managed) | $15-20 |
| Railway volumes (20 x 1GB) | $5 |
| **Infrastructure subtotal** | **$140-195** |
| LLM API costs — Kimi K2.5 default (20 tenants, moderate use) | $60-150 |
| LLM API costs — if some tenants use Claude Sonnet | +$50-200 |
| **Total estimated** | **$250-545/month** |

Note: Kimi K2.5 at ~$0.60/M input, $2.50/M output is dramatically cheaper than Claude Sonnet ($3/$15). Defaulting to Kimi K2.5 saves significant margin.

### 5.3 Secrets Management

Use **Railway sealed variables** for the POC. Sealed variables cannot be un-sealed once set, are not visible via UI or Railway API after sealing, and are injected as environment variables at container runtime.

Per-tenant sealed variables:
- `WINSTON_LLM_PROXY_URL` — points to the LLM proxy
- `OPENCLAW_GATEWAY_TOKEN` — auto-generated per tenant
- `TENANT_ID` — links container to Winston DB record
- Tenant-supplied integration keys (e.g., `TREEZ_API_KEY`, `DUTCHIE_API_KEY`)

Winston platform sealed variables (shared across platform services):
- `MOONSHOT_API_KEY` — real Kimi K2.5 key, only accessible by LLM proxy
- `ANTHROPIC_API_KEY` — real Anthropic key, only accessible by LLM proxy
- `OPENAI_API_KEY` — real OpenAI key, only accessible by LLM proxy
- `STRIPE_SECRET_KEY`
- `DATABASE_URL`

### 5.4 LLM Key Architecture

**Neither Anthropic nor Moonshot support programmatic API key creation.** This is why the LLM Proxy is architecturally required — not optional.

Each tenant's OpenClaw config points its model provider `baseUrl` to the LLM proxy. The proxy holds all real API keys and routes based on the tenant's selected model. See Section 3.1 for detailed request flow.

The OpenClaw container config for the model provider:
```json
{
  "models": {
    "providers": {
      "winston": {
        "baseUrl": "{{LLM_PROXY_URL}}",
        "apiKey": "winston-{{TENANT_ID}}",
        "api": "openai-completions",
        "models": [
          {
            "id": "kimi-k2.5",
            "name": "Kimi K2.5",
            "reasoning": true,
            "input": ["text", "image"],
            "contextWindow": 262000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

When a tenant changes their model selection in the dashboard, the Winston API:
1. Updates the tenant record in Postgres
2. Updates the proxy routing table (no container restart needed — the proxy routes based on tenant ID lookup)
3. Optionally updates the container's openclaw.json if model capabilities differ (context window, etc.) and restarts the gateway

---

## 6. Onboarding Provisioning Pipeline (Backend)

When "Launch Agent" is clicked, the Winston API executes:

### Step 1: Generate OpenClaw config files
- `openclaw.json` — gateway config, model provider pointing to LLM proxy, channel configs, tool policies (read-only default), memory settings
- `SOUL.md` — generated from agent name, soul/purpose, tone keywords, business context, includes credit exhaustion behavior directive
- `AGENTS.md` — capabilities derived from business questions and connectors
- `USER.md` — business details (name, location, hours)
- `IDENTITY.md` — agent name, emoji, vibe derived from tone keywords

### Step 2: Create skills directory
- Copy curated skill set based on industry and selected connectors
- For dispensaries: inventory-lookup, sales-summary, loyalty-lookup
- Generic: web-search, calendar, email
- Agents ARE allowed to create their own skills post-launch

### Step 3: Deploy Railway service
- Use Railway API to create new service from OpenClaw Docker template
- Mount persistent volume at `/data`
- Set sealed environment variables
- Configure health check endpoint
- Start gateway

### Step 4: Configure channels
- Inject Telegram bot token into container config
- Generate WebChat widget embed code with brand colors (served as embedded JS snippet from Winston CDN)
- If Slack: complete OAuth flow
- If WhatsApp: trigger QR pairing flow

### Step 5: Start log sync
- Register tenant with the sync worker
- Tail session JSONL files from container volume → Postgres

### Step 6: Update tenant record
- Status: `active`
- Store config snapshot in Postgres (version 1)
- Initialize credit balance based on tier

---

## 7. OpenClaw Configuration

### 7.1 Baseline Config Template

This is the base `openclaw.json` generated for every tenant. Variables in `{{brackets}}` are replaced by the provisioner.

```json
{
  "meta": {
    "lastTouchedVersion": "2026.2.x",
    "winston": {
      "tenantId": "{{TENANT_ID}}",
      "tier": "{{TIER}}",
      "baselineVersion": "1.0"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "{{GATEWAY_TOKEN}}"
    }
  },
  "models": {
    "providers": {
      "winston": {
        "baseUrl": "{{LLM_PROXY_URL}}",
        "apiKey": "winston-{{TENANT_ID}}",
        "api": "openai-completions",
        "models": [
          {
            "id": "kimi-k2.5",
            "name": "Kimi K2.5",
            "reasoning": true,
            "input": ["text", "image"],
            "contextWindow": 262000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": "winston/kimi-k2.5",
      "workspace": "/data/workspace",
      "memorySearch": {
        "enabled": true,
        "experimental": {
          "sessionMemory": true
        },
        "sources": ["memory", "sessions"]
      },
      "tools": {
        "profile": "minimal",
        "allow": ["read", "web_search", "memory_search", "memory_get"],
        "deny": ["exec", "write", "edit", "browser", "cron", "nodes"]
      }
    }
  },
  "channels": {
    "telegram": {
      "enabled": "{{TELEGRAM_ENABLED}}",
      "botToken": "{{TELEGRAM_BOT_TOKEN}}"
    },
    "slack": {
      "enabled": "{{SLACK_ENABLED}}"
    },
    "whatsapp": {
      "enabled": "{{WHATSAPP_ENABLED}}"
    }
  },
  "messages": {
    "contextOverflow": {
      "strategy": "auto-compact",
      "softThresholdTokens": 60000
    }
  },
  "skills": {
    "entries": {}
  }
}
```

### 7.2 Baseline Config Update Strategy

The baseline config is versionable and updatable across all tenants.

**Config versioning:**
- Each baseline config has a `winston.baselineVersion` field
- When the baseline is updated, the Winston API:
  1. Loads current tenant config
  2. Deep-merges new baseline fields (tenant overrides take precedence)
  3. Bumps `winston.baselineVersion`
  4. Writes new config to container volume
  5. Restarts gateway (rolling across tenants)
- Tenant-specific overrides (agent name, channels, connectors) are preserved
- Baseline changes (security policies, tool defaults, model versions) are applied

**Implementation:**
```
baseline_config_v{N}.json    (template, stored in Winston repo)
  + tenant_overrides.json    (per-tenant customizations, stored in Postgres)
  = final_openclaw.json      (merged at deploy time, written to container)
```

### 7.3 Sub-Agent Configuration

When a tenant's business questions indicate multiple distinct use cases, the provisioner configures sub-agents within a single gateway. See UI Step 4 where Winston suggests splitting into customer-facing and internal agents.

Each sub-agent gets:
- Its own SOUL.md, workspace, and tool policy
- Routing via channel bindings (e.g., webchat = customer agent, telegram = operations agent)
- Isolated sessions (no cross-talk)

---

## 8. Credit System

### 8.1 Credit Model

Credits map to LLM token usage. Base rate: **1 credit = 1,000 tokens** at the default Kimi K2.5 model. Other models apply a multiplier.

| Tier | Monthly Credits | Price | Approx. Conversations (Kimi K2.5) |
|------|----------------|-------|-----------------------------------|
| Free | 50,000 | $0 (card required) | ~150-300 conversations |
| Starter | 500,000 | $29/month | ~1,500-3,000 conversations |
| Growth | 2,000,000 | $99/month | ~6,000-12,000 conversations |
| Enterprise | Custom | Custom | Custom |

**Credit refresh:** Rolling 30-day cycle from signup date.

### 8.2 Model-Aware Credit Burn

| Model | Credit Multiplier | Cost per 1K tokens | Effective cost per conversation (~500 tokens) |
|-------|------------------|--------------------|--------------------------------------------|
| Kimi K2.5 (default) | 1.0x | 1 credit | ~0.5 credits |
| GPT-4o | 3.0x | 3 credits | ~1.5 credits |
| Claude Sonnet 4.5 | 5.0x | 5 credits | ~2.5 credits |
| Claude Opus 4.6 | 12.0x | 12 credits | ~6.0 credits |

Tenants see this in their dashboard when switching models:
> "Switching to Claude Sonnet 4.5 will use credits 5x faster than Kimi K2.5. At your current usage rate, your credits would last ~12 days instead of ~60 days."

### 8.3 Graceful Credit Exhaustion

When credits are exhausted, the LLM proxy returns a structured error. The agent's SOUL.md includes:

```markdown
## Credit Exhaustion Behavior
If you receive a "winston_credits_exhausted" error, respond with:
"I've used all my thinking energy for now! You can upgrade your plan at
{dashboard_url} to keep our conversation going, or I'll be refreshed
on {next_refresh_date}. I'm still here — just resting my brain."
```

The agent instance stays running. It can display the exhaustion message without making LLM calls because the message is pre-baked. This avoids the jarring experience of a dead agent.

**Credit warning at 20% remaining:** The proxy injects a header. On the next agent turn, SOUL.md instructs the agent to casually mention credits are getting low and link to upgrade.

---

## 9. Management Dashboard Features

### 9.1 Winston Team Capabilities
(See Section 4.3 for UI wireframes)

- **Tenant Overview:** Status, credits, channel health, last activity
- **Tenant Detail:** Config viewer/editor with version history and diff
- **Session Audit & Replay:** Searchable transcripts, step-through replay, tool call visibility
- **Backup & Restore:** One-click backup, restore to same or new container, exportable bundles
- **Skills Management:** Curated library, agent-created skill review queue, push to tenants
- **Health Monitoring:** Gateway uptime, channel connection status, credit exhaustion alerts
- **Global Config Updates:** Push baseline changes to all tenants with rolling restarts

### 9.2 Tenant Self-Service Capabilities
(See Section 4.2 for UI wireframes)

- Chat with agent directly via embedded WebChat
- View credit usage and remaining balance
- Upgrade/downgrade tier
- Manage channel connections
- Edit agent personality (simplified SOUL.md editor)
- View conversation history
- Manage connector API keys (add/rotate/revoke) — **self-service**
- Toggle connector access level (read-only ↔ read-write) — **self-service**
- Change AI model selection (with credit impact display)

---

## 10. Database Schema

```sql
-- Tenant organizations
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  industry VARCHAR(100),
  sub_industry VARCHAR(100),
  website_url VARCHAR(500),
  brand_colors JSONB,
  tier VARCHAR(50) NOT NULL DEFAULT 'free',
  status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
  selected_model VARCHAR(100) NOT NULL DEFAULT 'kimi-k2.5',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  credits_remaining DECIMAL(12,2) NOT NULL DEFAULT 50,
  credits_monthly_allotment DECIMAL(12,2) NOT NULL DEFAULT 50,
  credits_refresh_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Org instances (an org can have multiple instances)
CREATE TABLE tenant_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  instance_name VARCHAR(255),
  railway_service_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
  config_version VARCHAR(20),
  last_health_check TIMESTAMP,
  health_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Config snapshots for versioning and rollback
CREATE TABLE config_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  instance_id UUID REFERENCES tenant_instances(id),
  config_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Credit usage log
CREATE TABLE credit_usage (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  instance_id UUID REFERENCES tenant_instances(id),
  timestamp TIMESTAMP DEFAULT NOW(),
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  credits_used DECIMAL(10,4) NOT NULL,
  model VARCHAR(100),
  credit_multiplier DECIMAL(4,2),
  channel VARCHAR(50),
  session_id VARCHAR(255)
);

-- Session transcripts (synced from container JSONL)
-- Retention: 90 days default, configurable per tenant
CREATE TABLE session_transcripts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  instance_id UUID REFERENCES tenant_instances(id),
  session_id VARCHAR(255) NOT NULL,
  channel VARCHAR(50),
  agent_id VARCHAR(100),
  role VARCHAR(20) NOT NULL,
  content TEXT,
  tool_calls JSONB,
  tokens_used INTEGER,
  timestamp TIMESTAMP NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- 90 days from timestamp by default
);

-- Channel health tracking
CREATE TABLE channel_health (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  instance_id UUID REFERENCES tenant_instances(id),
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  last_message_at TIMESTAMP,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- Connector credentials (reference only — actual keys in Railway sealed vars)
CREATE TABLE tenant_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  connector_type VARCHAR(100) NOT NULL,
  display_name VARCHAR(255),
  access_level VARCHAR(20) DEFAULT 'read',
  status VARCHAR(50) DEFAULT 'active',
  railway_var_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  actor VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_usage_tenant_time ON credit_usage(tenant_id, timestamp);
CREATE INDEX idx_session_transcripts_tenant_session ON session_transcripts(tenant_id, session_id);
CREATE INDEX idx_session_transcripts_timestamp ON session_transcripts(tenant_id, timestamp);
CREATE INDEX idx_session_transcripts_expires ON session_transcripts(expires_at);
CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, timestamp);
CREATE INDEX idx_channel_health_tenant ON channel_health(tenant_id, channel);
```

---

## 11. Services Breakdown

| Service | Tech | Railway Config | Purpose |
|---------|------|---------------|---------|
| `winston-web` | Next.js + TypeScript | Web service, public | Onboarding app + tenant dashboard |
| `winston-api` | Node.js + Express | Web service, internal | Core API: provisioning, config, health |
| `winston-proxy` | Node.js | Web service, internal | **LLM proxy: metering, credit enforcement, model routing** |
| `winston-admin` | Next.js | Web service, auth-gated | Winston team management dashboard |
| `winston-db` | PostgreSQL 16 | Railway managed DB | Central data store |
| `winston-sync` | Node.js worker | Worker service | Tails container logs → Postgres |
| `tenant-{id}` | OpenClaw Docker | Per-tenant service | Individual agent gateways |

---

## 12. Development Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal: Core infrastructure, single tenant manually deployed**

- [ ] Set up Railway project with service structure
- [ ] Deploy PostgreSQL and run schema migrations
- [ ] Build LLM proxy service with multi-model routing and credit metering
- [ ] Set up Moonshot (Kimi K2.5) and Anthropic API accounts
- [ ] Create baseline OpenClaw config template
- [ ] Manually deploy one OpenClaw container as proof of concept
- [ ] Verify LLM proxy correctly intercepts, routes, and meters API calls across providers
- [ ] Write provisioning script that generates config files from parameters
- [ ] Test credit exhaustion flow end-to-end

**Deliverable:** One working agent on Telegram, metered through the proxy with Kimi K2.5, with config generated from a script.

### Phase 2: Provisioning Automation (Weeks 3-4)
**Goal: Automated tenant creation from API call**

- [ ] Build Winston API service with tenant CRUD endpoints
- [ ] Implement Railway API integration for programmatic service creation
- [ ] Build config generation pipeline (openclaw.json + SOUL.md + AGENTS.md from parameters)
- [ ] Implement sealed variable injection for tenant secrets
- [ ] Build website analysis endpoint (scrape → LLM → structured data, <10 second target)
- [ ] Build log sync worker (container JSONL → Postgres)
- [ ] Create SOUL.md templates for dispensary vertical
- [ ] Build curated skill set for dispensaries
- [ ] Implement sub-agent provisioning based on business question analysis

**Deliverable:** POST to `/api/tenants` with parameters creates a live agent on Railway within 2 minutes.

### Phase 3: Onboarding & Tenant Dashboard (Weeks 5-6)
**Goal: End-to-end onboarding experience and tenant self-service**

- [ ] Build onboarding web app (Next.js) — all 7 steps per wireframes in Section 4.1
- [ ] Implement website analysis with loading UX (<10 seconds)
- [ ] Build agent identity configuration with tone slider
- [ ] Build business questions with pre-population and sub-agent suggestion
- [ ] Build channel selection with Telegram inline instructions
- [ ] Build connector configuration with read/write toggle (self-service)
- [ ] Integrate Stripe for payment capture and tier selection
- [ ] Build review & launch with model selector and progress indicator
- [ ] Build tenant dashboard per wireframes in Section 4.2: chat, history, credits, channels, connectors, settings
- [ ] Build WebChat widget with brand color customization (embedded JS snippet)
- [ ] Build model switching in tenant settings with credit impact display

**Deliverable:** New user can go from landing page to live agent in under 10 minutes. Tenant can self-manage their agent.

### Phase 4: Management & Operations (Weeks 7-8)
**Goal: Winston team operational tooling and production readiness**

- [ ] Build Winston admin dashboard per wireframes in Section 4.3
- [ ] Build session audit/replay view with search and filters
- [ ] Build backup/restore functionality (one-click + scheduled nightly)
- [ ] Build skills management interface with agent-created skill review queue
- [ ] Build baseline config update mechanism (push to all tenants with rolling restart)
- [ ] Build health monitoring with alerts (channel disconnect, credit exhaustion)
- [ ] Implement 90-day session transcript retention with configurable override
- [ ] Build tenant notification system (email: credit warnings, channel issues)
- [ ] Load test with 20 concurrent tenants
- [ ] Write operations runbook for Winston team
- [ ] Document API reference
- [ ] Onboard 20 dispensary pilot tenants

**Deliverable:** 20 dispensary tenants onboarded, fully manageable through admin dashboard, with audit trail and operational tooling.

---

## 13. File Structure

```
winston/
├── packages/
│   ├── web/                    # Next.js onboarding + tenant dashboard
│   │   ├── app/
│   │   │   ├── onboarding/     # 7-step onboarding flow
│   │   │   ├── dashboard/      # Tenant self-service
│   │   │   └── auth/           # Login/signup
│   │   ├── components/
│   │   │   ├── onboarding/     # Step components
│   │   │   ├── dashboard/      # Dashboard panels
│   │   │   └── webchat/        # Embeddable WebChat widget
│   │   └── lib/
│   │
│   ├── admin/                  # Next.js Winston team dashboard
│   │   ├── app/
│   │   │   ├── tenants/        # Tenant list + detail
│   │   │   ├── sessions/       # Audit & replay
│   │   │   ├── skills/         # Skill management
│   │   │   ├── config/         # Global config management
│   │   │   └── health/         # Monitoring & alerts
│   │   └── components/
│   │
│   ├── api/                    # Winston API service
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── tenants.ts
│   │   │   │   ├── config.ts
│   │   │   │   ├── health.ts
│   │   │   │   ├── credits.ts
│   │   │   │   └── webhooks.ts  # Stripe webhooks
│   │   │   ├── services/
│   │   │   │   ├── provisioner.ts      # Creates tenant containers
│   │   │   │   ├── config-generator.ts # Generates OpenClaw configs
│   │   │   │   ├── website-analyzer.ts # Scrapes + analyzes websites
│   │   │   │   ├── railway-client.ts   # Railway API wrapper
│   │   │   │   └── model-router.ts     # Model selection + routing config
│   │   │   ├── templates/
│   │   │   │   ├── openclaw-base.json  # Baseline config template
│   │   │   │   ├── soul-dispensary.md  # SOUL.md for dispensaries
│   │   │   │   ├── soul-generic.md     # SOUL.md for generic SMB
│   │   │   │   ├── agents-dispensary.md
│   │   │   │   └── identity.md
│   │   │   └── db/
│   │   │       ├── schema.sql
│   │   │       └── migrations/
│   │   └── package.json
│   │
│   ├── proxy/                  # LLM Proxy service (CRITICAL)
│   │   ├── src/
│   │   │   ├── server.ts       # Express server, /v1/messages endpoint
│   │   │   ├── router.ts       # Routes to correct LLM provider
│   │   │   ├── metering.ts     # Token counting + credit deduction
│   │   │   ├── credit-check.ts # Balance check + exhaustion response
│   │   │   ├── providers/
│   │   │   │   ├── moonshot.ts   # Kimi K2.5 via Moonshot API
│   │   │   │   ├── anthropic.ts  # Claude models via Anthropic API
│   │   │   │   ├── openai.ts     # GPT models via OpenAI API
│   │   │   │   └── openrouter.ts # Fallback multi-provider
│   │   │   └── cache.ts        # Redis cache for credit balance lookups
│   │   └── package.json
│   │
│   └── sync/                   # Log sync worker
│       ├── src/
│       │   ├── worker.ts
│       │   ├── jsonl-parser.ts
│       │   ├── db-writer.ts
│       │   └── retention.ts    # 90-day cleanup job
│       └── package.json
│
├── skills/                     # Curated skill library
│   ├── dispensary/
│   │   ├── inventory-lookup/
│   │   │   └── SKILL.md
│   │   ├── sales-summary/
│   │   │   └── SKILL.md
│   │   └── loyalty-lookup/
│   │       └── SKILL.md
│   └── generic/
│       ├── web-search/
│       ├── calendar/
│       ├── social-media/
│       └── email-draft/
│
├── docker/
│   ├── openclaw-tenant/
│   │   ├── Dockerfile
│   │   └── entrypoint.sh       # Reads env vars, writes config, starts gateway
│   └── docker-compose.dev.yml
│
├── docs/
│   ├── architecture.md
│   ├── onboarding-flow.md
│   ├── operations-runbook.md
│   ├── api-reference.md
│   └── ui-ux-wireframes.md
│
├── railway.toml
├── package.json                # Monorepo root (turborepo or nx)
└── README.md
```

---

## 14. Key Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Default LLM model | Kimi K2.5 | ~76% cheaper than Claude, strong agent/tool-use capability, OpenAI-compatible API |
| Model switching | Tenant self-service with credit multiplier | Flexibility without ops burden; credits account for cost differential |
| OpenClaw integration | Wrap, don't fork | Track upstream updates, minimize maintenance burden |
| Infrastructure | Railway | Existing OpenClaw templates, usage-based pricing, API for automation |
| LLM key management | **Proxy pattern** (centralized real keys) | No provider supports programmatic key creation; proxy enables metering + model routing |
| Memory/persistence | OpenClaw native files + Postgres shadow | File-based works for agents; DB needed for auditability and management |
| Credit exhaustion | Proxy returns structured error; agent displays pre-baked message | Instance stays alive, no jarring shutdown |
| Credit refresh | Rolling 30-day from signup | Simpler than calendar-month; no mid-month confusion |
| Secrets | Railway sealed variables | Adequate for POC; upgrade to Vault/Infisical at scale |
| Default channel | Telegram (pre-selected in onboarding) | Simplest setup, most reliable, no session management issues |
| WebChat hosting | Embedded JS snippet from Winston CDN | Tenants paste snippet into any website builder (Wix, Shopify, Squarespace) |
| Config updates | Baseline template + tenant overrides merged at deploy | Platform-wide updates without losing customization |
| Tenant isolation | One gateway container per tenant | Clean isolation, independent scaling, no noisy neighbor |
| White labeling | Full — no Winston branding in tenant-facing experience | Agent name, personality, colors all customizable |
| Skill creation | Agents allowed to self-create skills | Empowers power users; Winston team reviews via admin dashboard |
| Connector access changes | Tenant self-service | Read/write toggle in tenant dashboard, no approval needed |
| Session retention | 90 days default, configurable per tenant | Balance storage cost with audit needs |
| Rate limiting | None | Simplifies POC; revisit if abuse detected |
| Sub-agents | Suggested based on business question analysis | Single gateway hosts multiple routed agents when use cases diverge |

---

## 15. Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Default model | Kimi K2.5. Tenants can switch models; credit burn rate adjusts via multiplier. |
| 2 | Rate limiting | No per-tenant rate limit for POC. |
| 3 | Credit refresh cycle | Rolling 30-day from signup date. |
| 4 | Compliance | Deferred — not in POC scope. |
| 5 | Treez data access | Deferred — not in POC scope. Winston treats Treez as any other connector. |
| 6 | WebChat hosting | Embedded JS snippet served from Winston CDN. |
| 7 | Session retention | 90 days default, configurable per tenant. |
| 8 | Skill auto-creation | Agents allowed to create skills. Winston team reviews in admin dashboard. |
| 9 | Connector write access | Self-service toggle in tenant dashboard. |
| 10 | Shared API key rate limits | Monitor during POC. OpenRouter provides fallback if Moonshot rate limits are hit. |

---

## 16. Remaining Open Items

1. **OpenRouter vs. direct Moonshot API:** OpenRouter provides multi-provider fallback and unified billing but adds a margin. Direct Moonshot API is cheaper but single point of failure. Recommendation: start with OpenRouter for reliability, optimize to direct later.

- use direct apis 

3. **WebChat widget framework:** Build custom React widget or use an existing open-source chat widget (e.g., Chatwoot widget)? Custom gives full branding control; existing saves 1-2 weeks.

- use existing webchat widget from within openclaw repo

4. **Onboarding website analysis model:** Use Kimi K2.5 (cheap) or Claude Sonnet (better at structured extraction) for the website analysis step? This is a one-time cost per tenant, so quality matters more than price.

-claude sonnet

5. **Multi-org support UX:** Schema supports multiple instances per org, but dashboard UX is single-instance for POC. When should the multi-instance UI be built?

-later

6. **Railway API limits:** Verify Railway's API supports programmatic service creation at the rate needed (20 services). Check if there are project-level service limits.
7. **Backup storage:** Where do tenant backups live? Railway Buckets (S3-compatible), or a separate S3 bucket owned by Winston?

railway buckets for poc
