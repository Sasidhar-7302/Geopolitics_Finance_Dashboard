import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type UserPreferences = {
  categories: string[];
  regions: string[];
  symbols: string[];
  onboarded: boolean;
  timezone: string;
  digestHour: number;
  emailDigestEnabled: boolean;
  deliveryChannels: string[];
  savedViewsEnabled: boolean;
  plan: string;
};

export function usePreferences() {
  const { data, error, isLoading, mutate } = useSWR<UserPreferences>(
    "/api/preferences",
    fetcher
  );

  const savePreferences = async (prefs: Partial<UserPreferences>) => {
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    const updated = await res.json();
    mutate(updated, false);
    return updated;
  };

  return {
    preferences: data ?? {
      categories: [],
      regions: [],
      symbols: [],
      onboarded: false,
      timezone: "UTC",
      digestHour: 7,
      emailDigestEnabled: true,
      deliveryChannels: ["email"],
      savedViewsEnabled: true,
      plan: "free",
    },
    isLoading,
    error,
    savePreferences,
    mutate,
  };
}
