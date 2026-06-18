import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MALALA",
    short_name: "MALALA",
    description: "Sistema interno de gestion de MALALA",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4efe8",
    theme_color: "#52744f",
    lang: "es-AR",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
