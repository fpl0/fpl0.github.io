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
      author: z.string().min(1).default("Filipe Lima"),
      tags: z.array(z.string()).default([]),

      image: z.string().optional(),
      isDraft: z.boolean().default(true),
      createdDate: z.coerce.date(),
      publicationDate: z.coerce.date().optional(),
    })
    .refine((data) => !data.publicationDate || data.publicationDate >= data.createdDate, {
      message: "publicationDate must be on or after createdDate",
      path: ["publicationDate"],
    })
    .transform((data) => ({
      ...data,
      date: data.publicationDate ?? data.createdDate,
    })),
});

export const collections = { blog } as const;
