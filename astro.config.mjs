// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import { satteri } from "@astrojs/markdown-satteri";

/**
 * Open absolute links in Markdown content in a new tab
 * (replaces the mdsvex `a` component override from the SvelteKit version).
 */
const externalLinks = {
    name: "external-links",
    element: {
        filter: ["a"],
        /**
         * @param {{ properties?: Record<string, unknown> }} node
         * @param {{ setProperty(node: unknown, key: string, value: unknown): void }} ctx
         */
        visit(node, ctx) {
            const href = node.properties?.href;
            if (typeof href === "string" && /^https?:\/\//.test(href)) {
                ctx.setProperty(node, "target", "_blank");
                ctx.setProperty(node, "rel", ["noreferrer", "nofollow", "noopener"]);
            }
        }
    }
};

export default defineConfig({
    site: "https://difff.app",
    // Keep the SvelteKit-era URLs (/formatter/yaml, not /formatter/yaml/).
    // `format: "file"` emits formatter/yaml.html, which Workers static assets
    // serves at /formatter/yaml with its default `auto-trailing-slash` handling.
    trailingSlash: "never",
    build: {
        format: "file"
    },
    prefetch: {
        prefetchAll: true,
        defaultStrategy: "hover"
    },
    integrations: [svelte()],
    markdown: {
        processor: satteri({ hastPlugins: [externalLinks] })
    }
});
