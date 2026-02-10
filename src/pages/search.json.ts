import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

// Ensure this is always pre-rendered at build time
export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog", ({ data }) => !data.isDraft);

  const searchIndex = posts.map((post) => ({
    title: post.data.title,
    summary: post.data.summary,
    tags: post.data.tags,
    slug: post.slug,
    date: post.data.date.toISOString(),
  }));

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
