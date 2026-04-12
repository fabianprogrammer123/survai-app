import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans, Space_Grotesk, Playfair_Display, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', display: 'swap' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://axiom-si.com";

export const metadata: Metadata = {
  title: {
    default: "Axiom Superintelligence — AI-Native Knowledge Capture at Scale",
    template: "%s | Axiom Superintelligence",
  },
  description:
    "Adaptive AI surveys that learn from every response. Capture tacit knowledge across voice, chat, and web — turning organizational expertise into actionable intelligence.",
  keywords: [
    "AI survey",
    "adaptive survey",
    "knowledge capture",
    "tacit knowledge",
    "AI-native surveys",
    "organizational intelligence",
    "knowledge management",
    "intelligent surveys",
    "AI feedback",
    "employee engagement survey",
    "customer experience AI",
    "survey builder AI",
    "knowledge graph",
    "conversational survey",
    "AI phone survey",
  ],
  authors: [{ name: "Axiom Superintelligence", url: siteUrl }],
  creator: "Axiom Superintelligence",
  publisher: "Axiom Superintelligence",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Axiom Superintelligence",
    title: "Axiom Superintelligence — Every Question Could Be Smarter",
    description:
      "AI-native knowledge capture. Adaptive surveys that learn from every response, extracting the tacit knowledge your organization can't afford to lose.",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Axiom Superintelligence — AI-Native Knowledge Capture",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Axiom Superintelligence — AI-Native Knowledge Capture",
    description:
      "Adaptive surveys that learn from every response. 85% of organizational knowledge is tacit — Axiom captures it.",
    images: [`${siteUrl}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    // GEO meta tags — Munich, Germany
    "geo.region": "DE-BY",
    "geo.placename": "Munich",
    "geo.position": "48.1351;11.5820",
    "ICBM": "48.1351, 11.5820",
  },
};

/* JSON-LD structured data */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Axiom Superintelligence",
      url: siteUrl,
      description:
        "AI-native knowledge capture platform. Adaptive surveys that learn from every response.",
      foundingLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Munich",
          addressRegion: "Bavaria",
          addressCountry: "DE",
        },
      },
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Axiom Superintelligence",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "Axiom",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "AI-native survey builder with adaptive questioning, multi-modal capture (web, voice, phone, chat), and continuous knowledge intelligence.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free to get started",
      },
      featureList: [
        "AI-generated adaptive surveys",
        "Multi-modal capture (web, voice, phone, WhatsApp, Slack)",
        "Real-time knowledge graph",
        "Conversational AI phone interviews",
        "Continuous intelligence dashboard",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} ${spaceGrotesk.variable} ${playfair.variable} ${jetbrainsMono.variable} ${outfit.variable} antialiased`}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
