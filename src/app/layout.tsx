import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Survai — Decentralized Intelligence",
  description: "Capture the tacit knowledge your organization runs on but has never written down.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className={`${geist.variable} ${spaceMono.variable} antialiased bg-[#08080c] text-[#d4d4e0]`}>
        {children}
      </body>
    </html>
  );
}
