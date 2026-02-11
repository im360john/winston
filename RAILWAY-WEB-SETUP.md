# Railway Setup Guide - Winston Web App

## Quick Manual Setup (5 minutes)

Since the Railway API is giving authorization issues, here's the manual setup process:

### Step 1: Create New Service in Railway

1. Go to your Railway project: https://railway.app/project/15a7aa96-1d45-4724-9248-b7d09310acdb

2. Click **"+ New"** → **"GitHub Repo"**

3. Select **`im360john/winston`** repo

4. Railway will ask for service name - enter: **`winston-web`**

### Step 2: Configure Build Settings

In the service settings:

1. **Root Directory:** `/packages/web`
2. **Build Command:** `npm install && npm run build`
3. **Start Command:** `npm start`
4. **Health Check Path:** `/` (optional)

### Step 3: Add Environment Variables

Add these variables in the service settings:

```bash
NEXT_PUBLIC_API_URL=https://winston-api-production.up.railway.app
NODE_ENV=production

# Stripe keys (add these once you have them from Stripe setup)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### Step 4: Generate Domain

1. In service settings, go to **"Networking"**
2. Click **"Generate Domain"**
3. Copy the generated URL (will be something like `winston-web-production.up.railway.app`)

### Step 5: Deploy

Railway should automatically deploy. If not, click **"Deploy"** button.

Wait ~2-3 minutes for:
- Dependencies to install
- Next.js build to complete
- Service to start

### Step 6: Test

Once deployed, visit your generated URL and you should see:
- ✅ Winston landing page with pricing tiers
- ✅ "Get Started Free" button leads to onboarding
- ✅ 7-step onboarding wizard

---

## What Works Now

- **Landing page** - Full marketing site with pricing
- **Onboarding flow** - Steps 1-6 work without Stripe
- **Website analysis** - Calls your existing API endpoint
- **Dashboard** - Basic UI (needs auth)

## What Needs Stripe Keys

- Step 1: Payment capture (will show Stripe error without keys)
- Step 7: Tenant creation and provisioning

## Stripe Setup (While Railway Deploys)

1. Go to https://dashboard.stripe.com/test/apikeys
2. Get your **Publishable key** (starts with `pk_test_`)
3. Get your **Secret key** (starts with `sk_test_`)
4. Add both to Railway environment variables
5. Restart the service

---

## Testing the Onboarding Flow

Once deployed and Stripe keys are added:

1. Visit `https://your-domain.up.railway.app`
2. Click **"Get Started Free"**
3. Fill in Step 1 (use test card: `4242 4242 4242 4242`)
4. Step 2: Enter any website URL (e.g., `https://example.com`)
5. Steps 3-6: Customize your agent
6. Step 7: Review and click "Launch"

This will:
- Create tenant in database
- Generate OpenClaw configs
- Deploy to Railway via provisioner
- Redirect to dashboard

---

## Troubleshooting

**Build Fails:**
- Check build logs in Railway
- Verify `packages/web` directory exists in repo
- Ensure `package.json` has correct scripts

**Service Won't Start:**
- Check that PORT is not hardcoded (Next.js uses Railway's PORT)
- Verify NODE_ENV=production is set
- Check start logs for errors

**Onboarding Errors:**
- Verify NEXT_PUBLIC_API_URL points to winston-api
- Check browser console for CORS errors
- Ensure Stripe keys are added

---

## Quick Checklist

- [ ] Create service in Railway dashboard
- [ ] Configure build settings (root dir, build command, start command)
- [ ] Add environment variables (API URL, Node env)
- [ ] Generate domain
- [ ] Wait for deployment (~2-3 min)
- [ ] Test landing page loads
- [ ] Add Stripe keys from dashboard
- [ ] Restart service
- [ ] Test full onboarding flow

---

**After setup, the URL will be:** `https://winston-web-production.up.railway.app`

Let me know once it's deployed and I'll help test it!
