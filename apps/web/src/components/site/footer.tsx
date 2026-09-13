import Link from "next/link";
import { Logo } from "@veste-ai/ui";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-ivory">
      <div className="container-veste grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo size={20} />
          <p className="max-w-sm text-sm leading-relaxed text-stone">
            A VESTE.AI não diz se uma roupa fica bonita ou feia em uma pessoa. Ela usa dados para estimar como aquela peça
            tende a vestir e ajudar o consumidor a tomar uma decisão de compra mais informada.
          </p>
        </div>
        <FooterCol
          title="Consumidor"
          links={[
            ["/consumidor/perfil", "Criar perfil"],
            ["/consumidor/foto", "Foto (opcional)"],
            ["/catalogo", "Catálogo"],
            ["/como-calculamos", "Como calculamos"],
          ]}
        />
        <FooterCol
          title="Empresas"
          links={[
            ["/empresa", "Studio B2B"],
            ["/empresa/api", "Testar API"],
            ["/empresa/widget", "Widget"],
            ["/loja-parceira", "Loja parceira (demo)"],
          ]}
        />
        <FooterCol
          title="Projeto"
          links={[
            ["/empresa/metricas", "Métricas"],
            [`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/docs`, "OpenAPI / Swagger"],
          ]}
        />
      </div>
      <div className="border-t border-border/70">
        <div className="container-veste flex flex-col gap-2 py-5 text-xs text-stone sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 VESTE.AI · MVP acadêmico — TCC Engenharia de Dados (FIAP)</span>
          <span>Parâmetros heurísticos do MVP · Dados simulados para demonstração</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow mb-4">{title}</p>
      <ul className="space-y-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-ink-2 transition hover:text-terracotta">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
