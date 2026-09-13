import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { ProfileProvider } from "@/lib/profile";
import { TooltipProvider } from "@/components/ui/misc";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT"],
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "VESTE.AI — Recomendação de tamanho e estimativa de caimento",
    template: "%s · VESTE.AI",
  },
  description:
    "A VESTE.AI usa dados para estimar como uma peça tende a vestir e ajudar você a escolher um tamanho com mais segurança.",
};

export const viewport: Viewport = {
  themeColor: "#F7F4EF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh font-sans">
        <ProfileProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </ProfileProvider>
      </body>
    </html>
  );
}
