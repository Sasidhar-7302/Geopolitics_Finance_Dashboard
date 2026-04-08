import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import CommandPalette from "./CommandPalette";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="shell-backdrop relative min-h-screen text-zinc-300">
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)}>
          <div
            className="h-full max-w-[19rem] p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <Sidebar onNavigate={() => setMobileNavOpen(false)} onClose={() => setMobileNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-3 px-3 py-3 lg:flex-row lg:gap-5 lg:px-5 lg:py-5">
        <aside className="hidden shrink-0 lg:block lg:w-[280px]">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Header
            onOpenNavigation={() => setMobileNavOpen(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
          <main className="flex-1 space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
