import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@/components/analytics";
import { Roboto_Flex, Roboto_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale, getT } from "@/lib/i18n/server";
import "./globals.css";
import { seoOrigin } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";

const roboto = Roboto_Flex({ variable: "--font-roboto", subsets: ["latin"] });
const robotoMono = Roboto_Mono({ variable: "--font-roboto-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    // Shared layouts persist across navigation; page URLs belong to page metadata.
    description: t("Connect to data and services through MCP tools, with one endpoint and one API key."),
    robots: { index: false, follow: true },
    metadataBase: new URL(seoOrigin()),
    title: { default: `McpRouter · ${t("MCP tools for everyone")}`, template: "%s · McpRouter" },
    publisher: "RxLab",
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
    icons: { icon: [{ url: "/brand/icon-v2.webp", type: "image/webp", sizes: "512x512" }] },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <StructuredData data={{
          "@context": "https://schema.org", "@graph": [
            { "@type": "Organization", "@id": "https://rxlab.app/#organization", name: "RxLab", url: "https://rxlab.app" },
            { "@type": "WebSite", "@id": `${seoOrigin()}/#website`, name: "McpRouter", url: seoOrigin(), publisher: { "@id": "https://rxlab.app/#organization" } },
          ],
        }} />
        <Suspense fallback={null}><Analytics /></Suspense>
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
