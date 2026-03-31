import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  return (
    <div className="relative min-h-screen bg-black text-zinc-300">
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)}>
          <div
            className="h-full max-w-[18rem] p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <Sidebar onNavigate={() => setMobileNavOpen(false)} onClose={() => setMobileNavOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-3 px-3 py-3 lg:flex-row lg:gap-4 lg:px-4">
        <aside className="hidden shrink-0 lg:block lg:w-56 xl:w-60">
          <Sidebar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Header onOpenNavigation={() => setMobileNavOpen(true)} />
          <main className="flex-1 space-y-3">{children}</main>
        </div>
      </div>
    </div>
  );
}
