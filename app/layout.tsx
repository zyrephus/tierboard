import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Shell } from "@/components/Shell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://tierboard.wilsonchenn.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TierBoard — Most Prestigious Tech Companies",
    template: "%s | TierBoard",
  },
  description: "Community-driven prestige rankings for tech companies. Vote anonymously in head-to-head matchups — live ELO rankings updated in real time.",
  keywords: ["tech companies", "prestige ranking", "FAANG", "software engineer", "best companies to work for", "ELO ranking", "tech jobs"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "TierBoard",
    url: siteUrl,
    title: "TierBoard — Most Prestigious Tech Companies",
    description: "Community-driven prestige rankings for tech companies. Vote anonymously in head-to-head matchups — live ELO rankings updated in real time.",
  },
  twitter: {
    card: "summary",
    title: "TierBoard — Most Prestigious Tech Companies",
    description: "Community-driven prestige rankings for tech companies. Vote anonymously in head-to-head matchups — live ELO rankings updated in real time.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body><Shell>{children}</Shell><Analytics /></body>
    </html>
  );
}
