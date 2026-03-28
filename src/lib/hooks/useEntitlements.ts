import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((response) => response.json());

export function useEntitlements() {
  const { data, error, isLoading, mutate } = useSWR("/api/me/entitlements", fetcher);

  return {
    entitlements: data,
    isLoading,
    error,
    mutate,
  };
}
