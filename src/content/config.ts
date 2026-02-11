/**
 * Content Collection Schemas
 *
 * Defines the frontmatter structure for blog posts and apps.
 * The `date` field is computed from publicationDate or createdDate.
 */

import { defineCollection, z } from "astro:content";

/**
 * Shared schema fields for all publishable content.
 * Both blog posts and apps share date handling, draft status, and tags.
 */
const publishableSchema = z
  .object({
    title: z.string(),
    summary: z
      .string()
      .min(50, "Summary must be at least 50 characters")
      .max(360, "Summary must be 360 characters or less"),
    tags: z.array(z.string()).default([]),
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
  }));

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

const apps = defineCollection({
  type: "content",
  schema: publishableSchema,
});

export const collections = { blog, apps } as const;
