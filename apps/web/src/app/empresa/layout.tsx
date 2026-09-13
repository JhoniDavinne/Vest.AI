import type { Metadata } from "next";
import { StudioShell } from "@/components/studio/studio-shell";

export const metadata: Metadata = { title: { default: "Studio", template: "%s · VESTE.AI Studio" } };

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <StudioShell>{children}</StudioShell>;
}
