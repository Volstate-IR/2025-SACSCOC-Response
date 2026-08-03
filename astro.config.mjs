// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import rehypeCite from './src/plugins/rehype-cite.mjs';

// https://astro.build/config
export default defineConfig({
	site: 'https://volstate-ir.github.io',
	base: '/2025-SACSCOC-Response',
	markdown: {
		processor: unified({
			rehypePlugins: [rehypeCite],
		}),
	},
});
