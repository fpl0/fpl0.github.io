/**
 * Blog Content Collection Schema
 *
 * Defines the frontmatter structure for blog posts.
 * The `date` field is computed from publicationDate or createdDate.
 */

import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z
    .object({
      title: z.string(),
      summary: z
        .string()
        .min(50, "Summary must be at least 50 characters")
        .max(360, "Summary must be 360 characters or less"),
      author: z.string().default("Filipe Lima"),

      image: z.string().optional(),
      isDraft: z.boolean().default(true),
      createdDate: z.coerce.date(),
      publicationDate: z.coerce.date().optional(),
    })
    .transform((data) => ({
      ...data,
      date: data.publicationDate ?? data.createdDate,
    })),
});

export const collections = { blog } as const;
