import type { Metadata } from "next";
import { SiteShell, PageIntro } from "@/components/site/shell";
import { MeasurementForm } from "@/components/consumer/measurement-form";
import { Steps } from "@/components/consumer/steps";

export const metadata: Metadata = { title: "Seu perfil" };

export default function ProfilePage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="Consumidor · Passo 1 de 3"
        title="Suas medidas, sua preferência."
        description="Informe os dados que alimentam a recomendação. Tudo pode ser ajustado depois — e a foto é sempre opcional."
        actions={<Steps current={1} />}
      />
      <div className="container-veste pb-20">
        <MeasurementForm />
      </div>
    </SiteShell>
  );
}
