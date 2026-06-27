import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Subir fotos de perfil de profesionales (hasta 4 MB) por Server Action.
    // El default de 1 MB las rechazaría.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
