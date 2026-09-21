import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes do monorepo consumidos diretamente do codigo-fonte TypeScript
  transpilePackages: ["@veste-ai/contracts", "@veste-ai/ui", "@veste-ai/widget"],
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ??
      (process.env.VERCEL ? "https://veste-api.onrender.com" : "http://localhost:8000"),
  },
};

export default nextConfig;
