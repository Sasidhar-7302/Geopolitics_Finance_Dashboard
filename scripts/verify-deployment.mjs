#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Verifies all environment variables and configuration before deployment
 * Usage: node scripts/verify-deployment.mjs [environment]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const REQUIRED_ENV_VARS = {
  production: [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID_MONTHLY",
    "STRIPE_PRICE_ID_YEARLY",
    "APP_URL",
    "CRON_SECRET",
  ],
  development: [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "APP_URL",
  ],
};

const SECRET_PATTERNS = {
  stripe_live: /\bsk_live_[A-Za-z0-9]+\b/,
  stripe_test: /\bsk_test_[A-Za-z0-9]+\b/,
  supabase_service_role: /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  webhook_secret: /whsec_[A-Za-z0-9]+/,
  database_url: /postgresql:\/\/[^@]+@/,
};

function validateEnvVar(name, value) {
  if (!value) {
    return { status: "missing", message: `❌ ${name} is not set` };
  }

  if (value === "CHANGE_ME" || value.includes("example")) {
    return {
      status: "placeholder",
      message: `⚠️  ${name} is a placeholder - must be set to real value`,
    };
  }

  // Check for suspicious patterns
  if (name.includes("STRIPE_SECRET_KEY")) {
    if (process.env.NODE_ENV === "production" && !value.startsWith("sk_live_")) {
      return {
        status: "warning",
        message: `⚠️  ${name} should be sk_live_* in production (found: ${value.substring(0, 10)}...)`,
      };
    }
  }

  return { status: "ok", message: `✅ ${name} is set` };
}

function checkSecretExposure(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const [pattern, regex] of Object.entries(SECRET_PATTERNS)) {
      const matches = content.match(regex);
      if (matches) {
        return { exposed: true, pattern, file: filePath, match: matches[0].substring(0, 20) };
      }
    }
  } catch (e) {
    // Ignore read errors
  }
  return { exposed: false };
}

function main() {
  const env = process.argv[2] || "development";
  const requiredVars = REQUIRED_ENV_VARS[env] || REQUIRED_ENV_VARS.development;

  console.log(`\n🔍 GeoPulse Environment Verification (${env})\n`);
  console.log("=".repeat(50));

  // Check environment variables
  console.log(`\n📋 Checking ${env} environment variables...\n`);

  let allValid = true;
  for (const varName of requiredVars) {
    const result = validateEnvVar(varName, process.env[varName]);
    console.log(`  ${result.message}`);
    if (result.status !== "ok") {
      allValid = false;
    }
  }

  // Check for exposed secrets in common files
  console.log(`\n🔐 Scanning for exposed secrets...\n`);

  const filesToCheck = [
    ".env.example",
    "docs/DEPLOYMENT.md",
    "docs/setup-guide.md",
    "src/lib/stripe.ts",
    "src/pages/api/webhooks/stripe.ts",
  ];

  let secretsExposed = false;
  for (const file of filesToCheck) {
    const fullPath = path.join(projectRoot, file);
    const result = checkSecretExposure(fullPath);
    if (result.exposed) {
      console.log(`  ❌ EXPOSED in ${result.file}: ${result.pattern} (${result.match}...)`);
      secretsExposed = true;
    }
  }

  if (!secretsExposed) {
    console.log("  ✅ No exposed secrets detected");
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (allValid && !secretsExposed) {
    console.log("✅ All checks passed - ready to deploy\n");
    process.exit(0);
  } else {
    console.log("❌ Deployment verification failed\n");
    console.log("Fix the issues above before deploying:");
    console.log("  - Set all required environment variables");
    console.log("  - Use real values (not CHANGE_ME)");
    console.log("  - Remove any exposed secrets\n");
    process.exit(1);
  }
}

main();

