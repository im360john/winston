# Deploying Winston Admin Dashboard to Railway

## Option 1: Railway Dashboard (Recommended)

1. **Go to Railway Dashboard**: https://railway.app/project/15a7aa96-1d45-4724-9248-b7d09310acdb

2. **Create New Service**:
   - Click "+ New"
   - Select "Empty Service"
   - Name it: `winston-admin`

3. **Configure Service**:
   - Go to Settings tab
   - Set Root Directory: `packages/admin`
   - Set Build Command: `npm install && npm run build`
   - Set Start Command: `npm start`

4. **Set Environment Variables**:
   ```
   WINSTON_API_URL=https://winston-api-production.up.railway.app
   NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}
   NEXTAUTH_SECRET=<generate-random-32-char-string>
   NODE_ENV=production
   ```

5. **Connect GitHub Repo**:
   - Settings → Connect GitHub Repo
   - Select: `winston` repository
   - Branch: `main`
   - Root Directory: `packages/admin`

6. **Generate Domain**:
   - Settings → Networking
   - Click "Generate Domain"
   - Copy the URL (e.g., `winston-admin-production.up.railway.app`)

7. **Deploy**:
   - Push to main branch or click "Deploy" in Railway dashboard

## Option 2: Railway CLI

```bash
# From the admin package directory
cd packages/admin

# Deploy (this will create the service if it doesn't exist)
railway up

# Add environment variables
railway variables set WINSTON_API_URL=https://winston-api-production.up.railway.app
railway variables set NEXTAUTH_URL=$(railway domain)
railway variables set NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Generate public domain
railway domain
```

## Post-Deployment

1. **Update NEXTAUTH_URL**:
   After domain is generated, update the variable to match:
   ```bash
   railway variables set NEXTAUTH_URL=https://winston-admin-production.up.railway.app
   ```

2. **Test the deployment**:
   ```bash
   curl https://winston-admin-production.up.railway.app
   ```

3. **Check logs**:
   ```bash
   railway logs
   ```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `WINSTON_API_URL` | Winston API base URL | `https://winston-api-production.up.railway.app` |
| `NEXTAUTH_URL` | Admin dashboard URL | `https://winston-admin-production.up.railway.app` |
| `NEXTAUTH_SECRET` | Secret for NextAuth | Random 32-char string |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Port (auto-set by Railway) | `3000` (Railway default) |

## Troubleshooting

### Build fails
- Check that Node.js version is compatible (v18+)
- Verify all dependencies are in package.json
- Check Railway build logs

### Runtime errors
- Verify all environment variables are set
- Check that WINSTON_API_URL points to correct API service
- Review runtime logs with `railway logs`

### Can't access admin dashboard
- Ensure public domain is generated
- Check that service is running (not crashed)
- Verify PORT is not hardcoded (let Railway set it)
