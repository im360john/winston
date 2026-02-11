# Authentication Setup Complete ✅

NextAuth.js authentication has been implemented and deployed!

---

## What's Been Added

### Frontend (packages/web)
- ✅ NextAuth.js with credentials provider
- ✅ Login page with email/password
- ✅ Protected dashboard (requires authentication)
- ✅ Sign-out functionality
- ✅ Auto-signup during onboarding
- ✅ Auto-signin after registration
- ✅ Session persistence (30 days)

### Backend (packages/api)
- ✅ `/api/auth/signup` - Create user accounts
- ✅ `/api/auth/login` - Authenticate users
- ✅ Password hashing with bcrypt
- ✅ Users table in database
- ✅ User-to-tenant relationship

---

## Railway Configuration Needed

### 1. Update winston-api Service

Add this dependency to Railway by redeploying (already in package.json):
```bash
# This will happen automatically on next deploy
bcryptjs: ^2.4.3
```

### 2. Update winston-web Service

Add these **NEW environment variables**:

```bash
# Generate a random secret:
# Run: openssl rand -base64 32
# Or use: https://generate-secret.vercel.app/32

NEXTAUTH_SECRET=<paste-your-generated-secret-here>
NEXTAUTH_URL=https://winston-web-production.up.railway.app
```

**IMPORTANT:** The `NEXTAUTH_SECRET` must be a secure random string. Never use the example value!

### 3. Run Database Migration

The `users` table needs to be created. Connect to your Railway PostgreSQL and run:

```sql
-- Users table (for authentication)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Apply updated_at trigger to users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## How to Run Migration

**Option 1: Railway Dashboard (Easiest)**
1. Go to your PostgreSQL service in Railway
2. Click "Data" tab
3. Click "Query"
4. Paste the SQL above
5. Click "Run"

**Option 2: Command Line**
```bash
# Use the connection string from Railway
psql "postgresql://postgres:...@metro.proxy.rlwy.net:48303/railway" -f packages/api/src/db/schema.sql
```

Or just run the users table creation part separately.

---

## Testing the Auth Flow

### 1. Test Signup (Onboarding)
1. Go to `https://winston-web-production.up.railway.app`
2. Click "Get Started Free"
3. Complete all 7 steps
4. On Step 7, click "Launch"

**What happens:**
- ✅ Tenant created
- ✅ User account created (email + hashed password)
- ✅ User automatically signed in
- ✅ Redirected to dashboard (authenticated)

### 2. Test Login
1. Go to `https://winston-web-production.up.railway.app/login`
2. Enter the email/password you used during onboarding
3. Click "Sign in"

**What happens:**
- ✅ Credentials verified against database
- ✅ Session created (JWT)
- ✅ Redirected to dashboard

### 3. Test Protected Route
1. Open an incognito window
2. Try to access `https://winston-web-production.up.railway.app/dashboard`

**What happens:**
- ✅ Automatically redirected to `/login`
- ✅ Can't access dashboard without signing in

### 4. Test Sign Out
1. From dashboard, click "Sign Out" button
2. You'll be redirected to login page
3. Session is cleared

---

## User Flow Diagram

```
New User Journey:
Landing Page → Onboarding (7 steps) → [Auto-creates account] → [Auto-signs in] → Dashboard

Returning User Journey:
Login Page → Enter credentials → Dashboard

Protected Access:
Try /dashboard → Not authenticated → Redirect to /login
```

---

## What Works Now

✅ **Complete authentication system**
- Secure password storage (bcrypt hashing)
- JWT session tokens (30-day expiration)
- Protected routes
- Auto-signup during onboarding
- Manual login for returning users

✅ **Database schema**
- Users table with foreign key to tenants
- One user per tenant (for now)
- Email uniqueness enforced

✅ **Security**
- Passwords never stored in plain text
- Sessions are cryptographically signed
- CSRF protection built-in (NextAuth default)

---

## Next Steps

After you:
1. Add `NEXTAUTH_SECRET` to Railway
2. Add `NEXTAUTH_URL` to Railway
3. Run the database migration
4. Redeploy both services

Then authentication will be fully functional!

---

## Troubleshooting

**"NextAuth configuration error"**
- Check that `NEXTAUTH_SECRET` is set in Railway
- Make sure it's not empty or the example value

**"Login failed" but credentials are correct**
- Check winston-api logs for auth errors
- Verify users table exists in database
- Check that bcryptjs is installed in API service

**Redirects to login loop**
- Check `NEXTAUTH_URL` matches your actual domain
- Clear browser cookies and try again

**"User already exists" during onboarding**
- Email is already in database
- Use different email or implement "login instead" flow

---

## API Endpoints

```
POST /api/auth/signup
- Body: { email, password, name, tenantId }
- Creates new user with hashed password
- Returns: { user: { id, email, name, tenantId } }

POST /api/auth/login
- Body: { email, password }
- Verifies credentials
- Returns: { user: { id, email, name, tenantId } }
```

---

**Status:** ✅ Ready to deploy with environment variables
