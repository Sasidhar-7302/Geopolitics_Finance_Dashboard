import { parseStringArray, stringifyStringArray } from "./json";

export const WORKSPACE_PANEL_KEYS = [
  "risk",
  "narratives",
  "market",
  "watchlist",
  "briefing",
  "timeline",
  "map",
] as const;

export const WORKSPACE_ACTIVE_VIEWS = ["command", "briefing", "map"] as const;
export const WORKSPACE_DENSITIES = ["comfortable", "compact"] as const;
export const WORKSPACE_LAYOUTS = ["focus", "balanced"] as const;

export type WorkspacePanelKey = (typeof WORKSPACE_PANEL_KEYS)[number];
export type WorkspaceActiveView = (typeof WORKSPACE_ACTIVE_VIEWS)[number];
export type WorkspaceDensity = (typeof WORKSPACE_DENSITIES)[number];
export type WorkspaceLayoutMode = (typeof WORKSPACE_LAYOUTS)[number];

export type WorkspaceState = {
  panelOrder: WorkspacePanelKey[];
  collapsedPanels: WorkspacePanelKey[];
  pinnedRegions: string[];
  pinnedSymbols: string[];
  defaultTimeWindow: string;
  defaultSort: "relevance" | "newest" | "severity" | "support";
  activeView: WorkspaceActiveView;
  density: WorkspaceDensity;
  layoutMode: WorkspaceLayoutMode;
  railCollapsed: boolean;
};

export const DEFAULT_WORKSPACE: WorkspaceState = {
  panelOrder: ["risk", "narratives", "market", "watchlist", "briefing"],
  collapsedPanels: [],
  pinnedRegions: [],
  pinnedSymbols: [],
  defaultTimeWindow: "24h",
  defaultSort: "relevance",
  activeView: "command",
  density: "comfortable",
  layoutMode: "focus",
  railCollapsed: false,
};

type WorkspaceRecordShape = {
  panelOrder?: string | null;
  collapsedPanels?: string | null;
  pinnedRegions?: string | null;
  pinnedSymbols?: string | null;
  defaultTimeWindow?: string | null;
  defaultSort?: string | null;
  activeView?: string | null;
  density?: string | null;
  layoutMode?: string | null;
  railCollapsed?: boolean | null;
};

type WorkspacePatch = Partial<WorkspaceState>;

function dedupeStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function sanitizePanelOrder(values: string[] | WorkspacePanelKey[] | undefined) {
  const valid = dedupeStrings((values ?? []) as string[]).filter((value): value is WorkspacePanelKey =>
    WORKSPACE_PANEL_KEYS.includes(value as WorkspacePanelKey)
  );

  return [
    ...valid,
    ...WORKSPACE_PANEL_KEYS.filter((key) => !valid.includes(key)),
  ] as WorkspacePanelKey[];
}

function sanitizeCollapsedPanels(values: string[] | WorkspacePanelKey[] | undefined) {
  return dedupeStrings((values ?? []) as string[]).filter((value): value is WorkspacePanelKey =>
    WORKSPACE_PANEL_KEYS.includes(value as WorkspacePanelKey)
  ) as WorkspacePanelKey[];
}

function sanitizeView(value: string | undefined): WorkspaceActiveView {
  return WORKSPACE_ACTIVE_VIEWS.includes(value as WorkspaceActiveView)
    ? (value as WorkspaceActiveView)
    : DEFAULT_WORKSPACE.activeView;
}

function sanitizeDensity(value: string | undefined): WorkspaceDensity {
  return WORKSPACE_DENSITIES.includes(value as WorkspaceDensity)
    ? (value as WorkspaceDensity)
    : DEFAULT_WORKSPACE.density;
}

function sanitizeLayout(value: string | undefined): WorkspaceLayoutMode {
  return WORKSPACE_LAYOUTS.includes(value as WorkspaceLayoutMode)
    ? (value as WorkspaceLayoutMode)
    : DEFAULT_WORKSPACE.layoutMode;
}

function sanitizeSort(value: string | undefined): WorkspaceState["defaultSort"] {
  const allowed = ["relevance", "newest", "severity", "support"] as const;
  return allowed.includes(value as WorkspaceState["defaultSort"])
    ? (value as WorkspaceState["defaultSort"])
    : DEFAULT_WORKSPACE.defaultSort;
}

export function getWorkspacePinLimit(premiumActive: boolean) {
  return premiumActive ? 10 : 4;
}

export function normalizeWorkspaceInput(
  input?: WorkspacePatch,
  options?: { premiumActive?: boolean }
): WorkspaceState {
  const pinLimit = getWorkspacePinLimit(Boolean(options?.premiumActive));

  return {
    panelOrder: sanitizePanelOrder(input?.panelOrder),
    collapsedPanels: sanitizeCollapsedPanels(input?.collapsedPanels),
    pinnedRegions: dedupeStrings(input?.pinnedRegions ?? []).slice(0, pinLimit),
    pinnedSymbols: dedupeStrings((input?.pinnedSymbols ?? []).map((symbol) => symbol.toUpperCase())).slice(0, pinLimit),
    defaultTimeWindow: input?.defaultTimeWindow?.trim() || DEFAULT_WORKSPACE.defaultTimeWindow,
    defaultSort: sanitizeSort(input?.defaultSort),
    activeView: sanitizeView(input?.activeView),
    density: sanitizeDensity(input?.density),
    layoutMode: sanitizeLayout(input?.layoutMode),
    railCollapsed: Boolean(input?.railCollapsed),
  };
}

export function mergeWorkspaceState(
  current: WorkspaceState,
  patch?: WorkspacePatch,
  options?: { premiumActive?: boolean }
) {
  return normalizeWorkspaceInput(
    {
      ...current,
      ...patch,
    },
    options
  );
}

export function parseWorkspaceRecord(
  record?: WorkspaceRecordShape | null,
  options?: { premiumActive?: boolean }
): WorkspaceState {
  if (!record) {
    return normalizeWorkspaceInput(DEFAULT_WORKSPACE, options);
  }

  return normalizeWorkspaceInput(
    {
      panelOrder: parseStringArray(record.panelOrder) as WorkspacePanelKey[],
      collapsedPanels: parseStringArray(record.collapsedPanels) as WorkspacePanelKey[],
      pinnedRegions: parseStringArray(record.pinnedRegions),
      pinnedSymbols: parseStringArray(record.pinnedSymbols),
      defaultTimeWindow: record.defaultTimeWindow || DEFAULT_WORKSPACE.defaultTimeWindow,
      defaultSort: sanitizeSort(record.defaultSort || undefined),
      activeView: sanitizeView(record.activeView || undefined),
      density: sanitizeDensity(record.density || undefined),
      layoutMode: sanitizeLayout(record.layoutMode || undefined),
      railCollapsed: Boolean(record.railCollapsed),
    },
    options
  );
}

export function serializeWorkspaceState(state: WorkspaceState) {
  return {
    panelOrder: stringifyStringArray(state.panelOrder),
    collapsedPanels: stringifyStringArray(state.collapsedPanels),
    pinnedRegions: stringifyStringArray(state.pinnedRegions),
    pinnedSymbols: stringifyStringArray(state.pinnedSymbols),
    defaultTimeWindow: state.defaultTimeWindow,
    defaultSort: state.defaultSort,
    activeView: state.activeView,
    density: state.density,
    layoutMode: state.layoutMode,
    railCollapsed: state.railCollapsed,
  };
}
