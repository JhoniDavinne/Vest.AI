import type { ReactNode } from "react";
import Link from "next/link";

export function PartnerStoreShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0f1210] text-[#f3efe6]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f1210]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/loja-parceira" className="font-display text-xl tracking-[0.18em]">
            ATELIER NORTE
          </Link>
          <nav className="flex items-center gap-6 text-[13px]">
            <Link href="/loja-parceira" className="text-white/70 hover:text-white">
              Coleção
            </Link>
            <span className="hidden text-white/35 sm:inline">Frete grátis acima de R$ 299</span>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 text-xs text-white/45 sm:grid-cols-3">
          <div>
            <p className="font-display text-sm tracking-[0.12em] text-white/70">ATELIER NORTE</p>
            <p className="mt-2 leading-relaxed">
              Peças essenciais com corte pensado, tecidos selecionados e acabamento cuidadoso.
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Atendimento</p>
            <ul className="mt-3 space-y-1.5">
              <li>Trocas em até 30 dias</li>
              <li>Entrega em todo o Brasil</li>
              <li>contato@ateliernorte.com.br</li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Pagamento</p>
            <ul className="mt-3 space-y-1.5">
              <li>Cartão em até 6x sem juros</li>
              <li>Pix com 5% de desconto</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-[11px] text-white/30">
          © {new Date().getFullYear()} Atelier Norte. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
