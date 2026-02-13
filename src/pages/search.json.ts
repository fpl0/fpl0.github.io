import type { APIRoute } from "astro";
import { getPublishedApps } from "../utils/apps";
import { getPublishedPosts } from "../utils/posts";

// Ensure this is always pre-rendered at build time
export const prerender = true;

export const GET: APIRoute = async () => {
  const [posts, apps] = await Promise.all([getPublishedPosts(), getPublishedApps()]);

  const searchIndex = [
    ...posts.map((post) => ({
      title: post.data.title,
      summary: post.data.summary,
      tags: post.data.tags,
      slug: post.slug,
      date: post.data.date.toISOString(),
      type: "post" as const,
    })),
    ...apps.map((app) => ({
      title: app.data.title,
      summary: app.data.summary,
      tags: app.data.tags,
      slug: app.slug,
      date: app.data.date.toISOString(),
      type: "app" as const,
    })),
  ];

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      "Content-Type": "application/json",
    },
  });
};
