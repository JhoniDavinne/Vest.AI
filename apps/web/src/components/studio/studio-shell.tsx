"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Boxes, Code2, ExternalLink, KeyRound, LayoutDashboard, Menu, Puzzle, Store, X } from "lucide-react";
import { Logo } from "@veste-ai/ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/empresa", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/empresa/produtos", label: "Produtos & SKUs", icon: Boxes },
  { href: "/empresa/api", label: "Testar API", icon: Code2 },
  { href: "/empresa/widget", label: "Widget", icon: Puzzle },
  { href: "/empresa/metricas", label: "Métricas", icon: BarChart3 },
  { href: "/empresa/integracoes", label: "Integrações", icon: KeyRound },
];

export function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              active ? "text-ivory" : "text-ivory/60 hover:text-ivory",
            )}
          >
            {active ? (
              <motion.span layoutId="studio-nav" className="absolute inset-0 rounded-xl bg-white/10" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            ) : null}
            <item.icon className="relative size-4" />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-ivory">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-ink p-5 text-ivory lg:flex">
        <div className="space-y-8">
          <div className="flex items-center justify-between px-1">
            <Link href="/">
              <Logo size={18} tone="ivory" />
            </Link>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ivory/70">Studio</span>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <p className="text-[10.5px] uppercase tracking-[0.16em] text-ivory/50">Empresa</p>
            <p className="mt-1 font-medium">Loja Parceira Demo</p>
            <p className="text-xs text-ivory/60">Plano Growth · E-commerce de moda</p>
          </div>
          {nav}
        </div>
        <div className="space-y-3">
          <Button asChild variant="outline" size="sm" className="w-full border-white/15 bg-transparent text-ivory hover:bg-white/10 hover:text-ivory">
            <Link href="/loja-parceira">
              <Store /> Ver loja parceira <ExternalLink className="ml-auto size-3.5" />
            </Link>
          </Button>
          <p className="px-1 text-[10.5px] leading-relaxed text-ivory/40">Dados simulados para demonstração.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <header className="flex items-center justify-between border-b border-border bg-paper px-5 py-3 lg:hidden">
          <Link href="/">
            <Logo size={18} />
          </Link>
          <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full p-2" aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </header>
        {open ? <div className="bg-ink p-4 lg:hidden">{nav}</div> : null}
        <main className="flex-1 px-5 py-8 sm:px-8 lg:px-12">{children}</main>
      </div>
    </div>
  );
}

export function StudioHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-medium md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-stone">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-paper p-5 shadow-soft">
      <p className="text-[11px] uppercase tracking-[0.14em] text-stone">{label}</p>
      <p className="mt-2 font-display text-3xl" style={{ color: accent }}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-stone">{hint}</p> : null}
    </div>
  );
}
