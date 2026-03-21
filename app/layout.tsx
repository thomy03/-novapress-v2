import type { Metadata, Viewport } from "next";
import { Inter, Newsreader, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/Providers";
import Script from "next/script";

// Variable fonts for modern typography
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-grotesk",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale and userScalable removed — WCAG 2.1 AA compliance
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "NovaPress AI - L'IA qui desose l'information",
    template: "%s | NovaPress AI",
  },
  description: "Agregateur de news alimente par l'IA. 53+ sources mondiales croisees, verifiees et synthetisees avec un score de transparence unique.",
  keywords: "actualites, intelligence artificielle, IA, news, veille, synthese, analyse, briefing",
  authors: [{ name: "NovaPress AI" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NovaPress",
  },
  openGraph: {
    title: "NovaPress AI - L'IA qui desose l'information",
    description: "Agregateur de news alimente par l'IA. 53+ sources mondiales croisees, verifiees et synthetisees avec un score de transparence unique.",
    type: "website",
    siteName: "NovaPress AI",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "NovaPress AI",
    description: "L'IA qui desose l'information — 53+ sources mondiales croisees et synthetisees par l'IA"
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
      className={`${inter.variable} ${newsreader.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark light" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-to-content">
          Aller au contenu principal
        </a>
        <Providers>
          <main id="main-content" tabIndex={-1} style={{ paddingBottom: '70px' }}>
            {children}
          </main>
        </Providers>

        {/* Service Worker */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
              .then(function(reg) { console.log('SW registered:', reg.scope); })
              .catch(function(err) { console.warn('SW registration failed:', err); });
          }
        `}</Script>
      </body>
    </html>
  );
}

