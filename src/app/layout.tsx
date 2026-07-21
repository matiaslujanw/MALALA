import type { Metadata } from "next";
import { Cinzel, Lato, Pinyon_Script } from "next/font/google";
import "./globals.css";

// Cinzel: mayúsculas con tracking (logo, títulos de sección).
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display",
});

// Texto corriente. El stack de globals.css antepone Gotham por si se licencia.
const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
});

// Caligrafía de los títulos editoriales de la landing ("Servicios").
const pinyonScript = Pinyon_Script({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-script",
});

export const metadata: Metadata = {
  title: "MALALA — Sistema de gestión",
  description: "MALALA Hair and Nails — gestión de ventas, stock y caja",
  applicationName: "MALALA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${cinzel.variable} ${lato.variable} ${pinyonScript.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
