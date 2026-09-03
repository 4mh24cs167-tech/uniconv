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
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9886149871233121"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
