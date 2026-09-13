import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function PartnerStoreShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0f1210] text-[#f3efe6]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f1210]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/loja-parceira" className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-[0.18em]">ATELIER NORTE</span>
            <span className="hidden text-[10px] uppercase tracking-[0.22em] text-white/45 sm:inline">loja parceira</span>
          </Link>
          <nav className="flex items-center gap-5 text-[13px]">
            <Link href="/loja-parceira" className="text-white/70 hover:text-white">
              Coleção
            </Link>
            <Link href="/" className="inline-flex items-center gap-1 text-white/50 hover:text-white">
              VESTE.AI <ArrowUpRight className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-10 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>ATELIER NORTE · e-commerce fictício para demonstrar o widget VESTE.AI.</p>
          <p>O motor de tamanho não mora nesta loja — ele é consumido via API.</p>
        </div>
      </footer>
    </div>
  );
}
