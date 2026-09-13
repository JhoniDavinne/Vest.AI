import { SiteFooter } from "./footer";
import { SiteHeader } from "./header";

export function SiteShell({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader tone={tone} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="container-veste flex flex-col gap-6 pb-10 pt-14 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl space-y-3">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="text-balance text-4xl font-medium leading-[1.05] md:text-5xl">{title}</h1>
        {description ? <p className="max-w-xl text-[15px] leading-relaxed text-stone">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
    </div>
  );
}
