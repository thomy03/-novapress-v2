import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./components/Providers";

export const metadata: Metadata = {
  title: "NovaPress AI - Intelligence Artificielle & Actualités",
  description: "Plateforme de veille intelligente alimentée par l'IA. Actualités, analyses et synthèses automatiques des dernières informations.",
  keywords: "actualités, intelligence artificielle, IA, news, veille, synthèse, analyse",
  authors: [{ name: "NovaPress AI" }],
  openGraph: {
    title: "NovaPress AI",
    description: "Plateforme de veille intelligente alimentée par l'IA",
    type: "website",
    siteName: "NovaPress AI"
  },
  twitter: {
    card: "summary_large_image",
    title: "NovaPress AI",
    description: "Plateforme de veille intelligente alimentée par l'IA"
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        <a href="#main-content" className="skip-to-content">
          Aller au contenu principal
        </a>
        <Providers>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
