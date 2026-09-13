"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Menu, Shirt, Store, UserRound, X } from "lucide-react";
import { Logo } from "@veste-ai/ui";
import { useProfile } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/catalogo", label: "Catálogo", icon: Shirt },
  { href: "/como-calculamos", label: "Como calculamos", icon: null },
  { href: "/loja-parceira", label: "Loja parceira", icon: Store },
  { href: "/empresa", label: "Studio B2B", icon: Building2 },
];

export function SiteHeader({ tone = "light" }: { tone?: "light" | "dark" }) {
  const pathname = usePathname();
  const { user } = useProfile();
  const [open, setOpen] = React.useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-md transition-colors",
        tone === "light" ? "border-border/70 bg-ivory/80" : "border-white/10 bg-ink/80 text-ivory",
      )}
    >
      <div className="container-veste flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Início">
          <Logo size={20} tone={tone === "light" ? "ink" : "ivory"} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors",
                  tone === "light" ? "text-stone hover:text-ink" : "text-ivory/70 hover:text-ivory",
                  active && (tone === "light" ? "text-ink" : "text-ivory"),
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-pill"
                    className={cn("absolute inset-0 rounded-full", tone === "light" ? "bg-paper shadow-soft" : "bg-white/10")}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                ) : null}
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/consumidor/perfil">
                <UserRound />
                {user.name.split(" ")[0]}
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/consumidor/perfil">Sou consumidor</Link>
            </Button>
          )}
        </div>

        <button
          type="button"
          className="rounded-full p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-border/70 bg-ivory px-5 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-paper"
              >
                {item.label}
              </Link>
            ))}
            <Button asChild className="mt-2">
              <Link href="/consumidor/perfil" onClick={() => setOpen(false)}>
                {user ? "Meu perfil" : "Sou consumidor"}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
