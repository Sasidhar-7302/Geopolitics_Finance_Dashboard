#!/bin/bash

# Production Deployment Pre-Flight Check Script
# Run this before every production deployment

set -e

echo "🔍 GeoPulse Production Pre-Deployment Check"
echo "=============================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

check_security_secrets() {
  echo ""
  echo "🔐 Checking for exposed secrets..."
  if npm run security:secrets > /dev/null 2>&1; then
    echo -e "${GREEN}✓ No exposed secrets found${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ Security check failed - exposed secrets detected${NC}"
    ((FAILED++))
  fi
}

check_typecheck() {
  echo ""
  echo "📝 Running TypeScript type checking..."
  if npm run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}✓ No TypeScript errors${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ TypeScript errors found${NC}"
    ((FAILED++))
  fi
}

check_tests() {
  echo ""
  echo "🧪 Running test suite..."
  if npm test > /dev/null 2>&1; then
    echo -e "${GREEN}✓ All tests passed${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ Tests failed${NC}"
    ((FAILED++))
  fi
}

check_build() {
  echo ""
  echo "🏗️  Building production bundle..."
  if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Build succeeded${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ Build failed${NC}"
    ((FAILED++))
  fi
}

check_git_status() {
  echo ""
  echo "📦 Checking git status..."
  if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}✓ Working tree clean${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠ Uncommitted changes${NC}"
    git status
  fi
}

check_env_variables() {
  echo ""
  echo "🔑 Checking environment variables..."
  MISSING=""
  
  for var in DATABASE_URL DIRECT_URL STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
    if [ -z "${!var}" ]; then
      MISSING="${MISSING} ${var}"
    fi
  done
  
  if [ -z "$MISSING" ]; then
    echo -e "${GREEN}✓ All required env vars set locally${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠ Missing:${MISSING}${NC}"
    echo "  (These should be set in Vercel dashboard for production)"
  fi
}

check_stripe_webhook() {
  echo ""
  echo "⚡ Checking Stripe webhook configuration..."
  if grep -q "STRIPE_WEBHOOK_SECRET" src/pages/api/webhooks/stripe.ts; then
    echo -e "${GREEN}✓ Webhook handler configured${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ Webhook handler not properly configured${NC}"
    ((FAILED++))
  fi
}

# Run all checks
check_git_status
check_env_variables
check_security_secrets
check_typecheck
check_tests
check_build
check_stripe_webhook

echo ""
echo "=============================================="
echo -e "Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
  echo -e "${RED}❌ Pre-deployment check FAILED${NC}"
  echo "Fix the issues above before deploying"
  exit 1
else
  echo -e "${GREEN}✅ All checks passed - Ready to deploy${NC}"
  exit 0
fi

