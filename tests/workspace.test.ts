import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WORKSPACE,
  mergeWorkspaceState,
  normalizeWorkspaceInput,
  parseWorkspaceRecord,
  serializeWorkspaceState,
} from "../src/lib/workspace";

test("normalizeWorkspaceInput enforces free-tier pin limits and normalizes symbols", () => {
  const workspace = normalizeWorkspaceInput(
    {
      pinnedRegions: ["Middle East", "Europe", "Asia-Pacific", "North America", "Latin America"],
      pinnedSymbols: ["uso", "xle", "gld", "smh", "tsm"],
    },
    { premiumActive: false }
  );

  assert.equal(workspace.pinnedRegions.length, 4);
  assert.deepEqual(workspace.pinnedSymbols, ["USO", "XLE", "GLD", "SMH"]);
});

test("mergeWorkspaceState preserves existing layout while applying the patch", () => {
  const merged = mergeWorkspaceState(
    DEFAULT_WORKSPACE,
    {
      activeView: "map",
      railCollapsed: true,
      collapsedPanels: ["market"],
    },
    { premiumActive: true }
  );

  assert.equal(merged.activeView, "map");
  assert.equal(merged.railCollapsed, true);
  assert.deepEqual(merged.collapsedPanels, ["market"]);
  assert.ok(merged.panelOrder.includes("risk"));
});

test("parseWorkspaceRecord and serializeWorkspaceState round-trip state safely", () => {
  const serialized = serializeWorkspaceState({
    ...DEFAULT_WORKSPACE,
    pinnedRegions: ["Middle East"],
    pinnedSymbols: ["USO", "XLE"],
    activeView: "briefing",
  });

  const parsed = parseWorkspaceRecord(serialized, { premiumActive: true });
  assert.deepEqual(parsed.pinnedRegions, ["Middle East"]);
  assert.deepEqual(parsed.pinnedSymbols, ["USO", "XLE"]);
  assert.equal(parsed.activeView, "briefing");
});
