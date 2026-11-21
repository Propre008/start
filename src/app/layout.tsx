import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ParityLens — RWA Parity, Liquidity & Issuer Intelligence Terminal",
  description:
    "Institutional-grade Real-World Asset parity monitor, multi-issuer depeg detector, liquidity fragmentation explorer, and hybrid Crypto + RWA portfolio lab powered by CoinMarketCap API v5.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${jetbrainsMono.variable}`}>
      <body className={`${geist.className} min-h-screen font-sans antialiased`}>{children}</body>
    </html>
  );
}
