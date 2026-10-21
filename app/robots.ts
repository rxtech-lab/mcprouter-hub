import type { MetadataRoute } from "next";
import { seoOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/mcp-app-sandbox"] }, sitemap: `${seoOrigin()}/sitemap.xml` };
}
