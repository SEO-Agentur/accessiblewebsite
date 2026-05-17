import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog posts: src/data/blog/<slug>.md or .mdx
// Each post is bilingual via the `language` frontmatter field and the
// blog listing groups posts by the current locale.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    language: z.enum(['en', 'de']),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const caseStudies = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/data/case-studies' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    language: z.enum(['en', 'de']),
    industry: z.string(),
    country: z.string().optional(),
    beforeScore: z.number().int().min(0).max(100),
    afterScore: z.number().int().min(0).max(100),
    durationDays: z.number().int().positive(),
    publishedAt: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, caseStudies };
