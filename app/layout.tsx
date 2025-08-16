import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaPress AI - Advanced News Intelligence Platform",
  description: "AI-powered news platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        {children}
      </body>
    </html>
  );
}