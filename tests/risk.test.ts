import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketRadar, buildNarrativeClusters, buildRiskBuckets } from "../src/lib/risk";

const now = Date.now();

const sampleEvents = [
  {
    id: "evt_1",
    title: "Red Sea disruption pushes tanker insurers higher",
    summary: "Shipping risk and military pressure are forcing another repricing in crude-linked assets.",
    source: "Reuters",
    region: "Middle East",
    countryCode: "YE",
    category: "energy",
    severity: 8,
    publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    duplicateClusterId: "energy:middle-east:red-sea",
    supportingSourcesCount: 3,
    sourceReliability: 0.94,
    relevanceScore: 8.4,
    whyThisMatters: "Energy route disruption is lifting cross-asset risk sensitivity.",
    correlations: [
      { symbol: "USO", impactScore: 0.84, impactDirection: "up", impactMagnitude: 2.2 },
      { symbol: "XLE", impactScore: 0.61, impactDirection: "up", impactMagnitude: 1.4 },
    ],
  },
  {
    id: "evt_2",
    title: "Defense escorts expand as shipping corridor remains stressed",
    summary: "Additional naval coverage follows a new round of attacks on commercial vessels.",
    source: "AP",
    region: "Middle East",
    countryCode: "YE",
    category: "conflict",
    severity: 7,
    publishedAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
    duplicateClusterId: "energy:middle-east:red-sea",
    supportingSourcesCount: 2,
    sourceReliability: 0.91,
    relevanceScore: 7.6,
    whyThisMatters: "The cluster keeps adding confirmation and keeping oil-linked pressure elevated.",
    correlations: [
      { symbol: "USO", impactScore: 0.73, impactDirection: "up", impactMagnitude: 1.8 },
      { symbol: "ITA", impactScore: 0.55, impactDirection: "up", impactMagnitude: 1.1 },
    ],
  },
  {
    id: "evt_3",
    title: "Taiwan export controls intensify chip supply concern",
    summary: "Manufacturing disruption concerns return to the semiconductor complex.",
    source: "BBC",
    region: "Asia-Pacific",
    countryCode: "TW",
    category: "technology",
    severity: 6,
    publishedAt: new Date(now - 30 * 60 * 60 * 1000).toISOString(),
    duplicateClusterId: "technology:asia:taiwan",
    supportingSourcesCount: 2,
    sourceReliability: 0.89,
    relevanceScore: 6.9,
    whyThisMatters: "Semiconductor supply risk can spread quickly into broad tech indices.",
    correlations: [
      { symbol: "TSM", impactScore: 0.81, impactDirection: "down", impactMagnitude: -2.6 },
      { symbol: "SMH", impactScore: 0.77, impactDirection: "down", impactMagnitude: -1.9 },
    ],
  },
];

test("buildRiskBuckets highlights the hottest region", () => {
  const regions = buildRiskBuckets(sampleEvents, "region");
  assert.equal(regions[0].scopeKey, "Middle East");
  assert.equal(regions[0].trend, "rising");
  assert.ok(regions[0].riskScore > regions[1].riskScore);
  assert.ok(regions[0].topSymbols.includes("USO"));
});

test("buildNarrativeClusters groups duplicate stories into a single narrative", () => {
  const narratives = buildNarrativeClusters(sampleEvents, 5);
  assert.equal(narratives.length, 2);
  assert.equal(narratives[0].clusterId, "energy:middle-east:red-sea");
  assert.ok(narratives[0].storyCount >= 2);
  assert.ok(narratives[0].watchSymbols.includes("USO"));
});

test("buildMarketRadar computes posture and movers from quotes", () => {
  const radar = buildMarketRadar(sampleEvents, [
    {
      symbol: "USO",
      price: 82,
      changePct: 3.2,
      provider: "snapshot",
      freshness: "snapshot",
      timestamp: new Date(now).toISOString(),
    },
    {
      symbol: "TSM",
      price: 148,
      changePct: -2.8,
      provider: "snapshot",
      freshness: "snapshot",
      timestamp: new Date(now).toISOString(),
    },
    {
      symbol: "SMH",
      price: 240,
      changePct: -1.7,
      provider: "snapshot",
      freshness: "snapshot",
      timestamp: new Date(now).toISOString(),
    },
  ]);

  assert.ok(radar.pressureScore > 0);
  assert.equal(radar.topMovers[0].symbol, "USO");
  assert.equal(radar.posture, "mixed");
});
