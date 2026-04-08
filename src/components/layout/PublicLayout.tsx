import Link from "next/link";
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="shell-backdrop relative min-h-screen overflow-x-hidden text-zinc-300">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1480px] min-w-0 flex-col px-4 py-4 sm:px-6 sm:py-8">
        <header className="command-surface mb-6 flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.06] bg-black/60 text-sm font-bold text-cyan">
              G
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-white">GeoPulse</p>
                <span className="kicker">Live Preview</span>
              </div>
              <p className="text-[11px] text-zinc-500 sm:max-w-none">
                Geopolitical risk translated into market context
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            <Link href="/#live-preview" className="status-pill">
              Live preview
            </Link>
            <Link href="/#plans" className="status-pill">
              Plans
            </Link>
            <Link href="/auth/signin" className="status-pill">
              Sign in
            </Link>
            <Link href="/auth/signup" className="btn-primary">
              Create free account
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
