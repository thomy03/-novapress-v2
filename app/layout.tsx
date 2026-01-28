import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/Providers";

// Variable fonts for modern typography
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "NovaPress AI - Intelligence Artificielle & Actualites",
  description: "Plateforme de veille intelligente alimentee par l'IA. Actualites, analyses et syntheses automatiques des dernieres informations.",
  keywords: "actualites, intelligence artificielle, IA, news, veille, synthese, analyse",
  authors: [{ name: "NovaPress AI" }],
  openGraph: {
    title: "NovaPress AI",
    description: "Plateforme de veille intelligente alimentee par l'IA",
    type: "website",
    siteName: "NovaPress AI"
  },
  twitter: {
    card: "summary_large_image",
    title: "NovaPress AI",
    description: "Plateforme de veille intelligente alimentee par l'IA"
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
    <html
      lang="fr"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark light" />
        <meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
      </head>
      <body className="antialiased">
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
