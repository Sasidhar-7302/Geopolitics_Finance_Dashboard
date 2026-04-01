import Link from "next/link";
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-zinc-300">
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl min-w-0 flex-col px-4 py-4 sm:px-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald/15 text-sm font-bold text-emerald">
              G
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">GeoPulse</p>
              <p className="text-[11px] text-zinc-500 sm:max-w-none">
                Geopolitical risk translated into market context
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            <Link href="/#live-preview" className="ghost-chip hover:bg-white/[0.06]">
              Live preview
            </Link>
            <Link href="/#plans" className="ghost-chip hover:bg-white/[0.06]">
              Plans
            </Link>
            <Link href="/auth/signin" className="ghost-chip hover:bg-white/[0.06]">
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
