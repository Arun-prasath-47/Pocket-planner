import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

const BASE_URL = "https://secure-spending-sidekick.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  component: SitemapPage,
});

function SitemapPage() {
  useEffect(() => {
    const entries: SitemapEntry[] = [
      { path: "/", changefreq: "weekly", priority: "1.0" },
      { path: "/auth", changefreq: "monthly", priority: "0.5" },
    ];
    const xml = buildSitemapXml(entries);
    document.open();
    document.write(xml);
    document.close();
  }, []);

  return null;
}
