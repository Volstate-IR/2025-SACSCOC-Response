import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const standards = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/standards" }),
	schema: z.object({
		title: z.string(),
		number: z.string(),
		order: z.number(),
		statement: z.string(),
		summary: z.string().optional(),
	}),
});

export const collections = { standards };
