import test from "node:test";
import assert from "node:assert/strict";
import { summarizeStoryTrust } from "../src/lib/trust";

test("summarizeStoryTrust marks well-confirmed stories as high confidence", () => {
  const trust = summarizeStoryTrust({
    supportingSourcesCount: 3,
    sourceReliability: 0.93,
    intelligenceQuality: 0.86,
    publishedAt: new Date().toISOString(),
  });

  assert.equal(trust.level, "high");
  assert.match(trust.label, /confidence/i);
  assert.ok(trust.overallScore >= 0.78);
});

test("summarizeStoryTrust marks single-source weak stories as developing", () => {
  const trust = summarizeStoryTrust({
    supportingSourcesCount: 1,
    sourceReliability: 0.62,
    intelligenceQuality: 0.31,
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  });

  assert.equal(trust.level, "developing");
  assert.match(trust.supportLabel, /single-source/i);
  assert.ok(trust.overallScore < 0.6);
});
