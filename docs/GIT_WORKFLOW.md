# Professional Git Workflow

## Branch Strategy

We follow a simplified Git Flow with these rules:

- **main**: Production-ready code only
  - Protected branch (requires PR reviews)
  - Auto-deploys to Vercel production
  - Every commit must be signed and tested

- **develop**: Integration branch for upcoming release
  - Optional, use for large features only
  - Requires 1 PR review before merge to main

- **feature/***:ature branches for development
  - Create from: `main`
  - Naming: `feature/stripe-integration`, `feature/user-dashboard`
  - Delete after merge
  - No production secrets in commits

## Before Starting Work

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Create a new feature branch
git checkout -b feature/your-feature-name

# 3. Install dependencies (if package.json changed)
npm install
```

## During Development

### Best Practices
- Commit frequently with descriptive messages
- Never commit `.env` or secret files
- Verify `.gitignore` before each commit
- Test locally before pushing

### Before Every Commit

```bash
# 1. Check for secrets
npm run security:secrets

# 2. Type check
npm run typecheck

# 3. Run tests
npm test

# 4. Verify no keys in diff
git diff --cached | grep -iE '(sk_|pk_|whsec_|eyJ)'

# 5. Then commit
git add .
git commit -m "Clear description of changes"
```

### Commit Message Format

Follow conventional commits:

```
type(scope): description

[optional body with more details]

[optional footer: closes #ISSUE]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `chore`: Maintenance
- `refactor`: Code restructuring
- `perf`: Performance improvement

**Examples:**
```
feat(stripe): add webhook endpoint for subscription events
fix(auth): handle expired JWT tokens correctly
docs(deployment): add production setup guide
chore: update dependencies to latest versions
```

## Creating a Pull Request

### 1. Push Your Branch
```bash
git push origin feature/your-feature-name
```

### 2. Create PR on GitHub
- Title: Clear, descriptive (will be in changelog)
- Description:
  - What changed and why
  - Testing performed
  - Any breaking changes
  - Screenshots if UI changes

### 3. PR Template
```markdown
## What
[Brief description of changes]

## Why
[Why these changes were made]

## How
[How to test the changes]

## Checklist
- [ ] No secrets in code or logs
- [ ] Tests pass (`npm test`)
- [ ] Type check passes (`npm run typecheck`)
- [ ] `npm run security:secrets` passes
- [ ] Appropriate comments added
- [ ] Documentation updated if needed

## Related Issues
Closes #123
```

## Code Review Checklist

Reviewers should verify:
- ✅ No secrets exposed
- ✅ Tests added/updated
- ✅ Type checking passes
- ✅ Code follows project style
- ✅ Documentation updated
- ✅ Database migrations (if applicable)
- ✅ Environment variables handled correctly

## Merging to Main

After approval:

```bash
# 1. Update branch with latest main
git fetch origin
git rebase origin/main

# 2. Push updated branch
git push origin feature/your-feature-name --force-with-lease

# 3. Merge via GitHub UI (squash for feature branches)
# Use "Squash and merge" for feature branches
# Use "Create a merge commit" for significant features

# 4. Delete branch after merge
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

## Secrets Incident Response

If a secret is accidentally committed:

### Immediate Actions
1. **Do NOT push to main**
2. Run: `npm run security:secrets`
3. If detected, add to `.gitignore` and amend commit:
   ```bash
   git rm --cached .env.local
   git add .gitignore
   git commit --amend --no-edit
   git push origin feature/your-feature origin --force-with-lease
   ```

### If Already Pushed
1. Create new secret at provider
2. Notify team immediately
3. Update environment variables in Vercel
4. Create PR to remove secret from history
5. Document incident in team channels

## Deployment Workflow

```bash
# 1. Merge to main
git checkout main
git pull origin main

# 2. Verify everything
npm run precheck     # Runs all security/build checks

# 3. If checks pass, Vercel auto-deploys
# Monitor at: https://vercel.com/dashboard

# 4. Verify deployment
curl https://your-domain.vercel.app/api/status
```

## Long-Lived Branch Updates

If working on a long feature branch, keep it updated:

```bash
# Fetch latest main
git fetch origin

# Rebase on latest main
git rebase origin/main

# Resolve conflicts if any
# Test locally
npm test

# Push with force-with-lease
git push origin feature/your-feature --force-with-lease
```

## Emergency Fixes (Production Hotfixes)

For critical production bugs:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/bug-description

# 2. Fix the bug
# - Make changes
# - Test thoroughly
# - Run all checks

# 3. Create PR marked as [HOTFIX]
# 4. Fast-track review and merge
# 5. Merge to main immediately
# 6. Tag release: git tag v0.1.1
```

## Local Setup for First Time

```bash
# Clone repository
git clone https://github.com/Sasidhar-7302/Geopolitics_Finance_Dashboard.git
cd Geopolitics_Finance_Dashboard

# Configure git
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Setup pre-commit hooks (recommended)
npm install husky --save-dev
npx husky install

# Install dependencies
npm install
```

## Useful Git Commands

```bash
# See what changed
git diff                 # Unstaged changes
git diff --cached        # Staged changes
git diff main feature/*   # Between branches

# History
git log --oneline -10    # Recent commits
git log --graph --all    # Visual branch history

# Clean up
git clean -fd            # Remove untracked files
git reset --hard HEAD    # Discard all local changes

# Find secrets in history
git log -p | grep -iE '(sk_|pk_|whsec_)'
```

