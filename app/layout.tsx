import type { Metadata } from "next";
import { Roboto_Flex, Roboto_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";
import { getLocale, getT } from "@/lib/i18n/server";
import "./globals.css";

const roboto = Roboto_Flex({ variable: "--font-roboto", subsets: ["latin"] });
const robotoMono = Roboto_Mono({ variable: "--font-roboto-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const description = t("Open data as MCP tools, for everyone. Starting with Hong Kong.");
  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "http://localhost:3000"),
    ),
    title: { default: "mcprouter", template: "%s · mcprouter" },
    description,
    icons: {
      icon: [
        { url: "/brand/icon-v2.webp", type: "image/webp", sizes: "512x512" },
      ],
    },
    openGraph: {
      title: "mcprouter",
      description,
      siteName: "mcprouter",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "mcprouter",
      description,
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${roboto.variable} ${robotoMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <I18nProvider locale={locale} messages={getMessages(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
