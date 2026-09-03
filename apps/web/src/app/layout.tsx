import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UniConv | The Ultimate File Converter",
  description: "Convert, merge, compress, and edit PDFs, images, and office documents instantly for free. No installation required.",
  keywords: ["pdf converter", "merge pdf", "compress pdf", "pdf to word", "remove watermark", "jpg to pdf", "convert files"],
  openGraph: {
    title: "UniConv | The Ultimate File Converter",
    description: "Convert, merge, compress, and edit PDFs, images, and office documents instantly for free.",
    url: "https://uniconv-psi.vercel.app",
    siteName: "UniConv",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UniConv | The Ultimate File Converter",
    description: "Convert, merge, compress, and edit PDFs, images, and office documents instantly for free.",
  }
};

import Script from "next/script";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
        <Script 
          src="https://pl31158858.profitableratecpmnetwork.com/62/2d/6e/622d6ea81de80505c7807566e3321b2e.js" 
          strategy="afterInteractive" 
        />
      </body>
    </html>
  );
}
