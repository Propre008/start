import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
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
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
