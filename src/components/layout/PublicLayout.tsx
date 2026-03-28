import Link from "next/link";
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black text-zinc-300">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald/15 text-sm font-bold text-emerald">
              G
            </div>
            <div>
              <p className="text-sm font-bold text-white">GeoPulse</p>
              <p className="text-[11px] text-zinc-500">Geopolitical risk translated into market context</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
