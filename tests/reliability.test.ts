import test from "node:test";
import assert from "node:assert/strict";
import { buildEventReliability, matchSourceHealth, summarizeSourceHealth } from "../src/lib/reliability";

const now = Date.now();

test("summarizeSourceHealth detects degraded and failed sources", () => {
  const overview = summarizeSourceHealth([
    {
      source: "Reuters",
      feedUrl: "https://feeds.reuters.com/world",
      status: "ok",
      lastFetchedAt: new Date(now - 20 * 60 * 1000).toISOString(),
      lastSucceededAt: new Date(now - 20 * 60 * 1000).toISOString(),
      successCount: 42,
      failureCount: 1,
      lastLatencyMs: 640,
    },
    {
      source: "BBC",
      feedUrl: "https://feeds.bbci.co.uk/news/world",
      status: "degraded",
      lastFetchedAt: new Date(now - 40 * 60 * 1000).toISOString(),
      lastSucceededAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
      successCount: 18,
      failureCount: 6,
      lastLatencyMs: 2100,
      lastError: "Transient parse issue",
    },
    {
      source: "GDELT",
      feedUrl: "https://gdeltproject.org/feed",
      status: "failed",
      lastFetchedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      lastSucceededAt: new Date(now - 40 * 60 * 60 * 1000).toISOString(),
      successCount: 3,
      failureCount: 14,
      lastLatencyMs: 5400,
      lastError: "Timeout",
    },
  ]);

  assert.equal(overview.totalFeeds, 3);
  assert.equal(overview.healthyFeeds, 1);
  assert.equal(overview.degradedFeeds, 1);
  assert.equal(overview.failedFeeds, 1);
  assert.equal(overview.status, "degraded");
  assert.equal(overview.activeIssues[0]?.source, "GDELT");
});

test("matchSourceHealth finds a source by exact name", () => {
  const overview = summarizeSourceHealth([
    {
      source: "Reuters",
      feedUrl: "https://feeds.reuters.com/world",
      status: "ok",
      lastFetchedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      lastSucceededAt: new Date(now - 5 * 60 * 1000).toISOString(),
      successCount: 10,
      failureCount: 0,
    },
  ]);

  const matched = matchSourceHealth(overview.sources, "Reuters");
  assert.ok(matched);
  assert.equal(matched?.status, "healthy");
});

test("buildEventReliability combines corroboration freshness and feed health", () => {
  const overview = summarizeSourceHealth([
    {
      source: "Reuters",
      feedUrl: "https://feeds.reuters.com/world",
      status: "ok",
      lastFetchedAt: new Date(now - 15 * 60 * 1000).toISOString(),
      lastSucceededAt: new Date(now - 15 * 60 * 1000).toISOString(),
      successCount: 24,
      failureCount: 1,
      lastLatencyMs: 700,
    },
  ]);

  const reliability = buildEventReliability({
    source: "Reuters",
    supportingSourcesCount: 3,
    sourceReliability: 0.94,
    intelligenceQuality: 0.86,
    publishedAt: new Date(now - 90 * 60 * 1000).toISOString(),
    sourceHealth: matchSourceHealth(overview.sources, "Reuters"),
  });

  assert.equal(reliability.level, "high");
  assert.equal(reliability.feedHealthStatus, "healthy");
  assert.ok(reliability.overallScore >= 0.8);
  assert.equal(reliability.corroborationLabel, "3 confirming sources");
});
