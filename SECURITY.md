# Security Policy

## Secrets Management

### Golden Rules
- **Never commit live secrets to Git** - Not now, not later, not in branches
- Real values belong ONLY in:
  - Vercel Environment Variables (for production)
  - Local untracked `.env` files (for development)
  - Provider dashboards (Supabase, Stripe, Cloudflare)
- All tracked examples in `.env.example` must be placeholders only
- Run `npm run security:secrets` before pushing ANY code changes

### Secret Categories

**🔐 Always Secret (Server-side only)**
- `SUPABASE_SERVICE_ROLE_KEY` - NEVER expose to frontend
- `STRIPE_SECRET_KEY` - API key for server-side transactions
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (whsec_...)
- `TURNSTILE_SECRET_KEY` - Bot verification secret
- `CRON_SECRET` - Protects scheduled jobs
- `DATABASE_URL` - Supabase connection string (pooled, port 6543)
- `DIRECT_URL` - Supabase connection string (direct, port 5432)

**🟢 Always Public (Safe for browser)**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project reference
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Public key (cannot write)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Bot verification site key (for frontend)

## Incident Response Procedure

If a secret is exposed in Git, chat, screenshots, logs, CI/CD, or anywhere outside Vercel:

1. **IMMEDIATELY rotate the secret at the provider:**
   - Stripe: Dashboard → API Keys → Roll API Key
   - Supabase: Settings → API → Regenerate Key
   - Cloudflare/Turnstile: Account → Manage

2. **Update production environment:**
   - Replace in Vercel dashboard with new secret
   - Test the deployment URL to confirm new secret works

3. **Clean up codebase:**
   - Remove from tracked files
   - Update `.env.example` if needed
   - Create PR with cleanup
   - Add to git history (if committed): `git log --all | grep "secret"` to verify removal

4. **Follow-up:**
   - Treat the old secret as **permanently compromised**
   - Document the incident
   - Review logs for unauthorized access during exposure window
   - Monitor billing/account for fraudulent activity

## GitHub Protection

### Enable These Settings
- ✅ Secret scanning: Settings → Security → Secret scanning → Enable
- ✅ Push protection: Settings → Security → Push protection → Enable
- ✅ Branch protection on `main`:
  - Require pull request reviews (1+ approvers)
  - Dismiss stale reviews
  - Require status checks to pass
  - Require branches to be up to date
  - Restrict who can push (only admins)

### Access Control
- Only team leads can edit production environment variables in Vercel
- Only admins can modify GitHub branch protection rules
- Require MFA for all contributors with push access

## Development Workflow

### Before Every Commit
```bash
# Check for secrets in your changes
npm run security:secrets

# Verify no API keys in git diff
git diff --cached | grep -iE '(sk_|pk_|whsec_|eyJ|0x4[A-Z0-9])'
```

### Before Every Push
```bash
# Run full test suite
npm test

# Run type check
npm run typecheck

# Security audit
npm audit fix  # Use with caution
npm run security:secrets
```

### Environment Variable Rotation Schedule
- **Stripe keys**: Rotate quarterly or after any exposure
- **Supabase keys**: Rotate semi-annually or after rotation
- **Webhook secrets**: Rotate on key rotation or monthly
- **CRON_SECRET**: Rotate monthly or on team membership changes
