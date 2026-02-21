import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/Providers";
import Script from "next/script";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark light" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <a href="#main-content" className="skip-to-content">
          Aller au contenu principal
        </a>
        <StyledJsxRegistry><Providers>
          <main id="main-content" tabIndex={-1} style={{ paddingBottom: '70px' }}>
            {children}
          </main>
        </Providers></StyledJsxRegistry>

        {/* Service Worker: unregister old, clear caches, register new */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(regs) {
              regs.forEach(function(reg) { reg.unregister(); });
              caches.keys().then(function(names) {
                names.forEach(function(name) { caches.delete(name); });
              });
              setTimeout(function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW v2.1 registered:', reg.scope); })
                  .catch(function(err) { console.warn('SW registration failed:', err); });
              }, 1000);
            });
          }
        `}</Script>
      </body>
    </html>
  );
}

