import type { Metadata } from "next";
import { SiteShell, PageIntro } from "@/components/site/shell";
import { PhotoUpload } from "@/components/consumer/photo-upload";
import { Steps } from "@/components/consumer/steps";

export const metadata: Metadata = { title: "Foto (opcional)" };

export default function PhotoPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="Consumidor · Passo 2 de 3 · Opcional"
        title="Uma foto pode enriquecer a estimativa."
        description="Análise visual experimental: extraímos apenas proporções aproximadas (ombro, cintura, quadril). Nenhuma imagem é armazenada."
        actions={<Steps current={2} />}
      />
      <div className="container-veste pb-20">
        <PhotoUpload />
      </div>
    </SiteShell>
  );
}
