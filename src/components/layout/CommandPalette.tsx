import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type CommandItem = {
  label: string;
  description: string;
  href: string;
  section: string;
};

const COMMAND_ITEMS: CommandItem[] = [
  { label: "Dashboard", description: "Open the command center", href: "/dashboard", section: "Navigation" },
  { label: "Morning Brief", description: "Read the structured daily briefing", href: "/digest", section: "Navigation" },
  { label: "Global Map", description: "Inspect regional risk on the map", href: "/map", section: "Navigation" },
  { label: "Timeline", description: "Scan the chronological signal feed", href: "/timeline", section: "Navigation" },
  { label: "Watchlist", description: "Review pinned symbols and exposures", href: "/assets", section: "Workspace" },
  { label: "Alerts", description: "Manage alerting rules", href: "/alerts", section: "Workspace" },
  { label: "Settings", description: "Preferences, delivery, and account settings", href: "/settings", section: "Workspace" },
];

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const timeout = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COMMAND_ITEMS;
    return COMMAND_ITEMS.filter((item) =>
      [item.label, item.description, item.section].some((field) => field.toLowerCase().includes(normalized))
    );
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-4 py-8 backdrop-blur-md" onClick={onClose}>
      <div
        className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-[#061019]/95 p-4 shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#07121c] px-4 py-3">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Go To</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              placeholder="Dashboard, map, alerts, settings..."
            />
            <span className="rounded-full border border-white/8 px-2 py-1 text-[10px] text-zinc-500">Esc</span>
          </div>
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3 transition hover:border-cyan/30 hover:bg-cyan/5"
                onClick={onClose}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{item.description}</p>
                </div>
                <span className="rounded-full border border-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                  {item.section}
                </span>
              </Link>
            ))}
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-zinc-500">
                No matching commands.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
