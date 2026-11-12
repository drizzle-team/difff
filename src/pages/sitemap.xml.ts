import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { toolPages } from "~/data/tools";

type Url = { path: string; lastmod: string; changefreq: string; priority: string };

export const GET: APIRoute = async ({ site }) => {
    const posts = await getCollection("changelog");
    const latestPost =
        posts
            .map((p) => p.data.lastmod)
            .sort()
            .at(-1) ?? "";

    const urls: Url[] = [
        ...toolPages.map((page) => ({
            path: page.path,
            lastmod: page.lastmod,
            changefreq: "yearly",
            priority: page.path.startsWith("/minifier/") ? "0.9" : "1.0"
        })),
        { path: "/changelog", lastmod: latestPost, changefreq: "weekly", priority: "0.6" },
        ...posts.map((post) => ({
            path: `/changelog/${post.id}`,
            lastmod: post.data.lastmod,
            changefreq: "yearly",
            priority: "0.7"
        }))
    ];

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
    .map(
        (url) => `  <url>
    <loc>${new URL(url.path, site)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
    )
    .join("\n")}
</urlset>
`;

    return new Response(body, { headers: { "Content-Type": "application/xml" } });
};
