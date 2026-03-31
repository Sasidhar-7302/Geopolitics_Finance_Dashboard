import test from "node:test";
import assert from "node:assert/strict";
import { summarizeEventIntelligence } from "../src/lib/intelligence";

test("low-signal consumer stories do not get a market explanation", () => {
  const result = summarizeEventIntelligence({
    title: "You've got mail: weekend newsletter highlights",
    summary: "A roundup of entertainment and lifestyle stories for subscribers.",
    region: "North America",
    severity: 2,
    publishedAt: new Date(),
    supportingSourcesCount: 1,
    sourceReliability: 0.7,
    symbols: [],
  });

  assert.equal(result.category, "general");
  assert.equal(result.whyThisMatters, null);
  assert.ok(result.intelligenceQuality < 0.4);
});

test("energy disruption stories retain strong market relevance", () => {
  const result = summarizeEventIntelligence({
    title: "Red Sea shipping disruption raises oil tanker insurance costs",
    summary: "Traders assess crude supply risk as shipping lanes face renewed military pressure.",
    region: "Middle East",
    severity: 8,
    publishedAt: new Date(),
    supportingSourcesCount: 3,
    sourceReliability: 0.92,
    symbols: ["USO", "XLE", "GLD"],
  });

  assert.equal(result.category, "energy");
  assert.ok(result.whyThisMatters);
  assert.ok(result.intelligenceQuality >= 0.7);
  assert.ok(result.relevanceScore > 5);
});
