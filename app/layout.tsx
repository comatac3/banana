import type { Metadata } from "next";
import { Geist, Geist_Mono, Bangers, Mitr } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bangers = Bangers({
  weight: "400",
  variable: "--font-bangers",
  subsets: ["latin"],
});

const mitr = Mitr({
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-mitr",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "Banana Pop - AI Product Placement",
  description: "Create viral-worthy product placements with AI avatars in seconds",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bangers.variable} ${mitr.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
