// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import rehypeCite from './src/plugins/rehype-cite.mjs';

// https://astro.build/config
export default defineConfig({
	build: {
		format: 'file',
	},
	markdown: {
		processor: unified({
			rehypePlugins: [rehypeCite],
		}),
	},
});
