import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export type SavedFilter = {
  id: string;
  name: string;
  query?: string | null;
  regions: string[];
  categories: string[];
  symbols: string[];
  direction: string;
  severityMin: number;
  timeWindow: string;
  sortKey: string;
  isPinned: boolean;
};

export function useSavedFilters() {
  const { data, error, isLoading, mutate } = useSWR("/api/saved-filters", fetcher);

  const saveFilter = async (payload: Omit<SavedFilter, "id">) => {
    const response = await fetch("/api/saved-filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    await mutate();
    return result;
  };

  const removeFilter = async (id: string) => {
    const response = await fetch(`/api/saved-filters?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    const result = await response.json();
    await mutate();
    return result;
  };

  return {
    savedFilters: (data?.savedFilters ?? []) as SavedFilter[],
    isLoading,
    error,
    mutate,
    saveFilter,
    removeFilter,
  };
}
