# Railway Deployment - Complete Setup Guide

**Date:** February 11, 2026
**Status:** 🟡 SERVICES CREATED - CONFIGURATION NEEDED

---

## ✅ What's Been Done

### 1. Railway Services Created
- **winston-proxy** (ID: `4ff6fe91-b5fe-4d5e-a92e-96bc59bef5ce`)
- **winston-api** (ID: `8d914bb7-4fa4-4cf3-80e6-55c2be1cfe3f`)
- **Project:** winston-poc (`15a7aa96-1d45-4724-9248-b7d09310acdb`)

### 2. Token Issues Resolved
- Railway API token type identified (Account token, not Project token)
- Fixed token loading in railway-provisioner.js
- Confirmed token permissions work for service creation

### 3. Code Updates
- `railway-provisioner.js`: Added dotenv loading, workspace ID support
- `railway-deploy-simple.js`: Created for simplified service deployment
- `.env`: Updated with working Railway API token

---

## 🔧 Manual Configuration Required

To complete the deployment, configure each service in the Railway dashboard:

### Service: winston-proxy (LLM Proxy)

**URL:** https://railway.app/project/15a7aa96-1d45-4724-9248-b7d09310acdb

#### Steps:
1. **Connect to GitHub**
   - Go to service settings
   - Connect repository: `im360john/winston`
   - Branch: `main`
   - Root directory: `packages/proxy`

2. **Set Environment Variables**
   ```
   ANTHROPIC_API_KEY=<your-anthropic-api-key>
   MOONSHOT_API_KEY=<your-moonshot-api-key>
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   NODE_ENV=production
   PORT=3002
   ```

3. **Deploy**
   - Railway will auto-build and deploy
   - Note the generated public URL for the proxy

---

### Service: winston-api (Winston API)

**URL:** https://railway.app/project/15a7aa96-1d45-4724-9248-b7d09310acdb

#### Steps:
1. **Connect to GitHub**
   - Go to service settings
   - Connect repository: `im360john/winston`
   - Branch: `main`
   - Root directory: `packages/api`

2. **Set Environment Variables**
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   LLM_PROXY_URL=<winston-proxy internal URL or public URL>
   RAILWAY_API_TOKEN=<your-railway-api-token>
   ANTHROPIC_API_KEY=<your-anthropic-api-key>
   MOONSHOT_API_KEY=<your-moonshot-api-key>
   NODE_ENV=production
   PORT=3001
   ```

3. **Deploy**
   - Railway will auto-build and deploy

---

### PostgreSQL Database

If not already added:

1. **Add Plugin**
   - Go to project → New → Database → PostgreSQL
   - Railway will provision a PostgreSQL instance

2. **Link to Services**
   - The `${{Postgres.DATABASE_URL}}` variable will auto-resolve
   - Both winston-proxy and winston-api will share this database

3. **Run Schema Migration**
   - After database is up, connect and run:
   ```bash
   psql $DATABASE_URL < packages/api/src/db/schema.sql
   ```

---

## 🧪 Testing the Deployment

Once all services are deployed:

### 1. Test LLM Proxy
```bash
curl -X POST https://<winston-proxy-url>/v1/messages \
  -H "Authorization: Bearer winston-00000000-0000-0000-0000-000000000000" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

### 2. Test Winston API
```bash
curl https://<winston-api-url>/api/health
```

### 3. Create a Test Tenant
```bash
curl -X POST https://<winston-api-url>/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Dispensary",
    "email": "test@example.com",
    "tier": "free",
    "selected_model": "claude-sonnet-4-5"
  }'
```

---

## 🚀 Next Steps

### Immediate:
1. ✅ Configure winston-proxy in Railway dashboard
2. ✅ Configure winston-api in Railway dashboard
3. ✅ Add PostgreSQL plugin
4. ✅ Run database migration
5. ✅ Deploy both services

### After Deployment:
1. Test end-to-end flow: API → LLM Proxy → Claude
2. Deploy a test tenant to Railway
3. Test tenant isolation
4. Monitor logs and performance

### Future Improvements:
1. Create custom Docker images with config decode scripts
2. Automate database migrations
3. Add health checks and monitoring
4. Implement Railway volume management for configs
5. Set up CI/CD for automatic deployments

---

## 📊 Current Architecture

```
User Request
    ↓
Winston API (Railway)
    ↓
Tenant Provisioning
    ↓
Railway Service Creation
    ↓
OpenClaw Container
    ↓
LLM Proxy (Railway)
    ↓
Anthropic/Moonshot APIs
```

---

## 🔑 Key Information

- **Project ID:** `15a7aa96-1d45-4724-9248-b7d09310acdb`
- **Environment:** production (`5cf26fdc-2170-4e7b-80e3-6390bf1a9bcc`)
- **Workspace:** im360john's Projects (`4a58ce21-7a1d-4a39-b095-dc7e75b1c2b3`)
- **Dashboard:** https://railway.app/project/15a7aa96-1d45-4724-9248-b7d09310acdb

---

## ⚠️ Known Issues

1. **Config File Distribution:** Tenant containers need config decode script
2. **Database Migration:** Must be run manually after PostgreSQL is provisioned
3. **Proxy URL:** Must update tenant env vars with actual deployed proxy URL
4. **OpenClaw Config Format:** May need adjustments for 2026 schema

---

**Status:** Ready for manual configuration in Railway dashboard.
**Estimated time to complete:** 15-20 minutes

