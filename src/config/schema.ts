import { z } from 'zod'
import type {
  Addon,
  ApiFramework,
  Archetype,
  ProjectConfig,
  WebFramework,
} from '../wizard/prompts.js'

export const ArchetypeSchema = z.enum([
  'cli',
  'library',
  'api',
  'full-stack',
  'convex-full-stack',
  'convex-saas',
]) satisfies z.ZodType<Archetype>

export const ApiFrameworkSchema = z.enum([
  'hono',
  'express',
  'elysia',
]) satisfies z.ZodType<ApiFramework>

export const WebFrameworkSchema = z.enum([
  'react-vite',
  'nextjs',
  'vue',
  'tanstack-start',
]) satisfies z.ZodType<WebFramework>

export const AddonSchema = z.enum([
  'docker',
  'ci',
  'release',
  'dependabot',
  'docs',
  'security',
  'zod',
  'neverthrow',
  'effect',
  'convex',
  'tanstack-query',
  'tanstack-router',
  'tanstack-form',
  'greet',
]) satisfies z.ZodType<Addon>

export const LicenseSchema = z.enum(['MIT', 'Apache-2.0', 'ISC', 'GPL-3.0', 'BSD-3-Clause'])

export const ProjectConfigSchema = z
  .object({
    projectName: z
      .string()
      .min(1, 'Project name is required')
      .regex(
        /^[a-z][a-z0-9-]*$/,
        'Project name must start with a letter and contain only lowercase letters, numbers, and hyphens',
      )
      .max(214, 'Project name must be 214 characters or less'),

    description: z.string().min(1, 'Description is required'),

    author: z.string().default(''),

    license: LicenseSchema.default('MIT'),

    githubUsername: z.string().default(''),

    archetype: ArchetypeSchema,

    apiFramework: ApiFrameworkSchema.optional(),

    webFramework: WebFrameworkSchema.optional(),

    addons: z.array(AddonSchema).default([]),
  })
  .transform(
    (data): ProjectConfig => ({
      ...data,
      apiFramework: data.apiFramework,
      webFramework: data.webFramework,
    }),
  )
  .refine(
    (data) => {
      if (data.archetype === 'api' || data.archetype === 'full-stack') {
        return data.apiFramework !== undefined
      }
      return true
    },
    {
      message: 'apiFramework is required for api and full-stack archetypes',
      path: ['apiFramework'],
    },
  )
  .refine(
    (data) => {
      if (data.archetype === 'full-stack') {
        return data.webFramework !== undefined
      }
      return true
    },
    {
      message: 'webFramework is required for full-stack archetype',
      path: ['webFramework'],
    },
  )

export type ProjectConfigInput = z.input<typeof ProjectConfigSchema>

export type { ProjectConfig }
