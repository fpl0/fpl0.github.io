// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";
import rehypeTaskListLabels from "./src/plugins/rehype-task-list-labels.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://fpl0.github.io",
  base: "/",
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport", // Prefetch links when they enter viewport
  },
  build: {
    inlineStylesheets: "always",
  },
  integrations: [sitemap(), mdx()],
  image: {
    // Optimize images to WebP with good quality
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: {
        limitInputPixels: false,
      },
    },
  },
  markdown: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeTaskListLabels],
    shikiConfig: {
      themes: {
        light: "github-light-high-contrast",
        dark: "vesper",
      },
      defaultColor: false, // Use CSS variables instead of inline colors
    },
  },
});
