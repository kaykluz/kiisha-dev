# Deploying Kiisha to Railway

## Quick Start (5 minutes)

### Step 1: Create Railway Account & Project

1. Go to [railway.app](https://railway.app) and sign up (GitHub auth recommended)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub and select the Kiisha repository

### Step 2: Add MySQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database" → "MySQL"**
3. Railway will automatically create a `DATABASE_URL` variable

### Step 3: Configure Environment Variables

1. Click on your **Kiisha service** (not the database)
2. Go to **"Variables"** tab
3. Add the following **required** variables:

```
NODE_ENV=production
JWT_SECRET=<generate-a-32-char-secret>
KIISHA_BASE_URL=https://<your-app>.railway.app
KIISHA_BASE_HOST=<your-app>.railway.app
ADMIN_EMAIL=your@email.com
```

**To generate JWT_SECRET:**
```bash
openssl rand -base64 32
```

### Step 4: Deploy

Railway will automatically deploy when you push to your main branch.

To trigger manual deploy:
1. Go to **"Deployments"** tab
2. Click **"Deploy"** or push a commit

### Step 5: Get Your URL

1. Go to **"Settings"** tab
2. Under **"Domains"**, click **"Generate Domain"**
3. Your app will be live at `https://<name>.railway.app`

---

## Custom Domain Setup

1. In Railway, go to **Settings → Domains**
2. Click **"+ Custom Domain"**
3. Enter your domain (e.g., `app.kiisha.io`)
4. Add the CNAME record to your DNS:
   - **Type:** CNAME
   - **Name:** app (or your subdomain)
   - **Value:** `<your-project>.railway.app`

---

## Environment Variables Reference

### Required for Basic Operation

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | Auto-set by Railway MySQL |
| `JWT_SECRET` | Auth token signing key | `openssl rand -base64 32` |
| `NODE_ENV` | Environment mode | `production` |
| `KIISHA_BASE_URL` | Full app URL | `https://app.kiisha.io` |
| `ADMIN_EMAIL` | Admin user email | `admin@company.com` |

### Optional - AI Features

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `ANTHROPIC_API_KEY` | Claude API key |
| `AI_SECRETS_KEY` | Encryption key for stored AI creds |

### Optional - Email

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend.com API key |
| `EMAIL_FROM` | From name and email |

### Optional - Payments

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe public key (for frontend) |

---

## Database Migrations

After first deploy, run migrations:

1. Go to Railway dashboard
2. Click on your Kiisha service
3. Go to **"Settings" → "Run Command"** (or use Railway CLI)
4. Run:
```bash
pnpm run db:push
```

Or via Railway CLI:
```bash
railway run pnpm run db:push
```

---

## Monitoring & Logs

### View Logs
1. Click on your service in Railway
2. Go to **"Deployments"** tab
3. Click on active deployment to see logs

### Health Check
Your app exposes these endpoints:
- `GET /api/health` - Full health status with DB check
- `GET /api/ready` - Readiness probe
- `GET /api/live` - Liveness probe

---

## Troubleshooting

### Build Fails
- Check that `pnpm-lock.yaml` is committed
- Ensure Node version compatibility (requires Node 20+)

### Database Connection Issues
- Verify `DATABASE_URL` is set (Railway should auto-inject this)
- Check if MySQL service is running

### App Crashes on Start
- Check logs for missing environment variables
- Ensure `JWT_SECRET` is set

### Static Files Not Loading
- Verify build completed successfully
- Check that `dist/public` folder was created

---

## Estimated Costs

| Usage Level | Monthly Cost |
|-------------|--------------|
| Development/Testing | ~$5 |
| Small Production (< 1k users) | ~$7-10 |
| Medium Production (1-10k users) | ~$15-25 |

Railway charges based on:
- **Compute:** $0.000463/GB RAM/minute
- **Database:** $0.000231/GB storage/hour
- **Bandwidth:** $0.10/GB after 100GB free

---

## Railway CLI Commands

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up

# View logs
railway logs

# Run command in production
railway run <command>

# Open dashboard
railway open
```

---

## Need Help?

- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- Check `/api/health` endpoint for diagnostics
