import type { Metadata } from "next";
import { Roboto_Flex, Roboto_Mono } from "next/font/google";
import "./globals.css";

const roboto = Roboto_Flex({ variable: "--font-roboto", subsets: ["latin"] });
const robotoMono = Roboto_Mono({ variable: "--font-roboto-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: { default: "mcprouter", template: "%s · mcprouter" },
  description: "Hong Kong open data as MCP tools.",
  icons: {
    icon: [
      { url: "/brand/icon-v2.webp", type: "image/webp", sizes: "512x512" },
    ],
  },
  openGraph: {
    title: "mcprouter",
    description: "Hong Kong open data as MCP tools.",
    siteName: "mcprouter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mcprouter",
    description: "Hong Kong open data as MCP tools.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
