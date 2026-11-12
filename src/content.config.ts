import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** SEO articles rendered under each tool, e.g. id `formatters/json`. */
const tools = defineCollection({
    loader: glob({ base: "./src/content/tools", pattern: "**/*.md" })
});

/** Weekly change & decision log posts, id is the `DD-MM-YYYY` file name. */
const changelog = defineCollection({
    loader: glob({ base: "./src/content/changelog", pattern: "*.md" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        weekNumber: z.number(),
        metaTitle: z.string(),
        metaDescription: z.string(),
        lastmod: z.string()
    })
});

export const collections = { tools, changelog };
