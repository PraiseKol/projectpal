// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://projectpal.site";
const SUPABASE_URL = "https://sbejtmywvxxamsuqnwun.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZWp0bXl3dnh4YW1zdXFud3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2Nzk5NjAsImV4cCI6MjEwOTI1NTk2MH0.kkk37HSBgvCz9_Pbv82RsrT4sOT9Yv-p5tTtXfue_70";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

async function fetchRows(table: string, query: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function main() {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/pricing", changefreq: "weekly", priority: "0.9" },
    { path: "/auth", changefreq: "monthly", priority: "0.5" },
    { path: "/blog", changefreq: "daily", priority: "0.9" },
    { path: "/topics", changefreq: "weekly", priority: "0.9" },
  ];

  const posts = await fetchRows(
    "blog_posts",
    "select=slug,updated_at&published=eq.true"
  );
  for (const p of posts) {
    entries.push({
      path: `/blog/${p.slug}`,
      lastmod: p.updated_at?.split("T")[0],
      changefreq: "monthly",
      priority: "0.8",
    });
  }

  const topics = await fetchRows(
    "project_topics",
    "select=department&limit=1000"
  );
  const depts = [...new Set(topics.map((t: any) => t.department))];
  for (const dept of depts) {
    entries.push({
      path: `/topics/${dept}`,
      changefreq: "monthly",
      priority: "0.8",
    });
  }

  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");

  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`sitemap.xml written (${entries.length} entries)`);
}

main();