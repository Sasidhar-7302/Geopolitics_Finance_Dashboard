import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = process.cwd();

const ignoredFiles = new Set([
  ".env.example",
  "docs/setup-guide.md",
  "docs/billing-guide.md",
  "README.md",
]);

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "out",
  "build",
]);

const allowedExtensions = new Set([
  ".cjs",
  ".cts",
  ".env",
  ".example",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".prisma",
  ".ps1",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const lineRules = [
  {
    id: "stripe-live-secret",
    pattern: /\bsk_(live|test)_[A-Za-z0-9]+\b/,
    message: "Stripe secret key detected.",
  },
  {
    id: "stripe-publishable-key",
    pattern: /\bpk_(live|test)_[A-Za-z0-9]+\b/,
    message: "Stripe publishable key detected in a tracked file.",
  },
  {
    id: "database-url",
    pattern: /^(DATABASE_URL|DIRECT_URL)\s*=\s*["']?postgres(?:ql)?:\/\/.+@/m,
    message: "Database connection string with credentials detected.",
    allow(line) {
      return (
        line.includes("postgres.xxxxx:password@") ||
        line.includes("postgresql://...") ||
        line.includes("CHANGE_ME") ||
        line.includes("example")
      );
    },
  },
  {
    id: "supabase-service-role",
    pattern: /^SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?.+/m,
    message: "Supabase service role key detected.",
    allow(line) {
      return line.includes('"eyJ..."') || line.includes('"CHANGE_ME"');
    },
  },
  {
    id: "cron-secret",
    pattern: /^CRON_SECRET\s*=\s*["']?.+/m,
    message: "Cron secret detected.",
    allow(line) {
      return (
        line.includes("CHANGE_ME") ||
        line.includes("generate-a-random-secret") ||
        line.includes("founder@example.com")
      );
    },
  },
  {
    id: "turnstile-secret",
    pattern: /^TURNSTILE_SECRET_KEY\s*=\s*["']?.+/m,
    message: "Turnstile secret detected.",
    allow(line) {
      return line.includes('0x4AAAA...') || line.includes('"CHANGE_ME"');
    },
  },
  {
    id: "nextauth-secret",
    pattern: /^NEXTAUTH_SECRET\s*=\s*["']?.+/m,
    message: "NextAuth secret detected.",
    allow(line) {
      return line.includes("CHANGE_ME") || line.includes("example");
    },
  },
];

function shouldScanFile(file) {
  if (ignoredFiles.has(file)) {
    return false;
  }

  if (file.startsWith(".env") && file !== ".env.example") {
    return false;
  }

  const extension = extname(file);
  return allowedExtensions.has(extension) || file === "Dockerfile";
}

function collectCandidateFiles(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = join(directory, entry.name);
    const relativePath = relative(root, absolutePath).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      collectCandidateFiles(absolutePath, found);
      continue;
    }

    if (entry.isFile() && shouldScanFile(relativePath)) {
      found.push(relativePath);
    }
  }

  return found;
}

function collectMatches(file, content) {
  const matches = [];
  const lines = content.split(/\r?\n/);

  for (const rule of lineRules) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!rule.pattern.test(line)) {
        continue;
      }

      if (typeof rule.allow === "function" && rule.allow(line)) {
        continue;
      }

      matches.push({
        file,
        line: index + 1,
        message: rule.message,
      });
    }
  }

  return matches;
}

function main() {
  const trackedFiles = collectCandidateFiles(root);
  const findings = [];

  for (const file of trackedFiles) {
    const absolutePath = resolve(root, file);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      continue;
    }

    const content = readFileSync(absolutePath, "utf8");
    findings.push(...collectMatches(file, content));
  }

  if (findings.length > 0) {
    console.error("Potential secrets found in tracked files:");
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line} ${finding.message}`);
    }
    process.exit(1);
  }

  console.log("No obvious secrets found in tracked files.");
}

main();
