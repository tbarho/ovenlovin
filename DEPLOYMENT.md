# Deployment Guide

## Vercel Configuration

The project is configured to deploy on Vercel with the following setup:

### Project Settings

In the Vercel dashboard, configure:

- **Root Directory**: `apps/web`
- **Framework Preset**: Next.js
- **Build Command**: Uses the custom command from `apps/web/vercel.json`
- **Output Directory**: (leave empty, Next.js default)

The `apps/web/vercel.json` file contains:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "cd ../.. && pnpm install && pnpm turbo run build --filter=@ovenlovin/web..."
}
```

This build command:
1. Goes to the repository root
2. Installs all dependencies
3. Uses Turborepo to build `@ovenlovin/web` and all its workspace dependencies

### Required Environment Variables

Configure these in the Vercel dashboard (Settings → Environment Variables):

#### Database (Required)
- `DATABASE_URL` - Neon Postgres connection string
  - Format: `postgresql://[user]:[password]@[host]/[database]?sslmode=require`
  - Get from Neon dashboard

#### Authentication (Required)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- Get both from Clerk dashboard

#### AI Services (Required for import features)
- `AI_GATEWAY_URL` - Vercel AI Gateway URL
- `SPACEX_API_KEY` - xAI API key for Grok models
- Get AI Gateway URL from Vercel AI dashboard
- Get xAI key from x.ai console

#### Optional
- `NEXT_PUBLIC_APP_URL` - Base URL for the app (auto-set by Vercel)

### Database Migrations

After the first successful deployment, run migrations:

```bash
# Option 1: From your local machine
DATABASE_URL="your-production-db-url" pnpm --filter @ovenlovin/db db:migrate

# Option 2: Add to build command (not recommended for production)
# Modify apps/web/vercel.json buildCommand to include:
# && cd packages/db && pnpm db:migrate

# Option 3: Use Vercel CLI
npx vercel env pull .env.local
pnpm --filter @ovenlovin/db db:migrate
```

### Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftbarho%2Fovenlovin&root-directory=apps/web&env=DATABASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,AI_GATEWAY_URL,SPACEX_API_KEY)

When deploying via the button:
1. Click the button above
2. Create a Vercel account or sign in
3. Create a new Neon database (or provide existing connection string)
4. Set up Clerk authentication
5. Configure Vercel AI Gateway
6. Add all environment variables
7. Deploy

After deployment:
1. Run database migrations (see above)
2. Verify the homepage loads: `https://your-project.vercel.app`
3. Check API health: `https://your-project.vercel.app/api/v1/health`
4. Test OpenAPI spec: `https://your-project.vercel.app/api/v1/openapi.json`

### Troubleshooting

#### Build Fails
- Check environment variables are set
- Verify DATABASE_URL is accessible from Vercel
- Check build logs: `npx vercel inspect <deployment-id> --logs`

#### 404 Errors
- Ensure Root Directory is set to `apps/web`
- Verify Framework Preset is Next.js
- Check `apps/web/vercel.json` exists in the repository

#### Database Connection Errors
- Verify DATABASE_URL format includes `?sslmode=require`
- Check Neon database allows connections from Vercel
- Ensure migrations have been run

## Local Development

```bash
# Set up environment variables
cp .env.example .env
# Edit .env with your local values

# Install dependencies
pnpm install

# Run database migrations
pnpm --filter @ovenlovin/db db:migrate

# Start development server
pnpm dev
```

Access at `http://localhost:3000`

## Production Checklist

Before going to production:

- [ ] All environment variables configured
- [ ] Database migrations run
- [ ] Clerk authentication tested
- [ ] AI import features tested
- [ ] OpenAPI spec accessible
- [ ] MCP endpoint returns 200 or 401 (not 404)
- [ ] Error monitoring configured (e.g., Sentry)
- [ ] Rate limiting configured
- [ ] CORS policies reviewed
