import { z } from 'zod'
import { DEFAULT_ADMIN_PATH } from '../constants.js'

const PATH_FORBIDDEN = /[\x00-\x1F\s?#]/

export const pathSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((v) => v.startsWith('/'), { message: 'Path must start with /' })
  .refine((v) => !v.includes('..'), { message: 'Path must not contain ..' })
  .refine((v) => !PATH_FORBIDDEN.test(v), {
    message: 'Path must not contain whitespace, control characters, ? or #',
  })
  .refine(
    (v) => v !== DEFAULT_ADMIN_PATH && !v.startsWith(`${DEFAULT_ADMIN_PATH}/`),
    { message: `Path cannot conflict with the admin path (${DEFAULT_ADMIN_PATH})` }
  )

export const nameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\w\s\-_.]+$/, {
    message: 'Name may only contain letters, digits, spaces, -, _, .',
  })

export const upstreamHostSchema = z.string().min(1).max(255)

export const advancedJsonSchema = z
  .object({
    client_max_body_size_mb: z.number().int().positive().optional(),
    proxy_read_timeout_s: z.number().int().positive().optional(),
    proxy_connect_timeout_s: z.number().int().positive().optional(),
    request_headers: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .optional(),
    response_headers: z
      .array(z.object({ name: z.string(), value: z.string() }))
      .optional(),
    rate_limit_req_per_sec: z.number().int().min(0).optional(),
  })
  .strict()

export const createRouteSchema = z.object({
  group_id: z.string().uuid().nullable().optional(),
  name: nameSchema,
  path: pathSchema,
  upstream_host: upstreamHostSchema,
  upstream_port: z.number().int().min(1).max(65535),
  upstream_scheme: z.enum(['http', 'https']).default('http'),
  strip_prefix: z.boolean().default(true),
  websocket: z.boolean().default(false),
  enabled: z.boolean().default(true),
  description: z.string().max(1000).nullable().optional(),
  advanced_json: advancedJsonSchema.optional(),
})

export const createFileRouteSchema = z.object({
  group_id: z.string().uuid().nullable().optional(),
  name: nameSchema,
  path: pathSchema,
  folder_path: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('/'), { message: 'Folder path must be absolute' })
    .refine((v) => !v.includes('..'), { message: 'Folder path must not contain ..' }),
  index_files: z.string().default('index.html'),
  dir_listing: z.boolean().default(false),
  try_files: z.string().nullable().optional(),
  spa_mode: z.boolean().default(false),
  enabled: z.boolean().default(true),
  description: z.string().max(1000).nullable().optional(),
  advanced_json: advancedJsonSchema.optional(),
})

export const createGroupSchema = z.object({
  kind: z.enum(['proxy', 'file']),
  name: nameSchema,
  description: z.string().max(1000).nullable().optional(),
})

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
})

export type CreateRouteInput = z.infer<typeof createRouteSchema>
export type CreateFileRouteInput = z.infer<typeof createFileRouteSchema>
export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
