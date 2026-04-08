import useSWR from "swr";
import type { WorkspaceState } from "../workspace";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

type WorkspaceResponse = {
  workspace: WorkspaceState;
  limits: {
    pinnedEntities: number;
  };
};

const FALLBACK_WORKSPACE: WorkspaceState = {
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

export function useWorkspace() {
  const { data, error, isLoading, mutate } = useSWR<WorkspaceResponse>("/api/workspace", fetcher);

  const saveWorkspace = async (patch: Partial<WorkspaceState>) => {
    const response = await fetch("/api/workspace", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });
    const updated = (await response.json()) as WorkspaceResponse;
    mutate(updated, false);
    return updated;
  };

  return {
    workspace: data?.workspace ?? FALLBACK_WORKSPACE,
    limits: data?.limits ?? { pinnedEntities: 4 },
    isLoading,
    error,
    mutate,
    saveWorkspace,
  };
}
