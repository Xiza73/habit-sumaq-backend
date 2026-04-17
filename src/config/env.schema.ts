import { z } from 'zod';

export const envSchema = z
  .object({
    // App
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3010),
    APP_URL: z.url(),

    // Database
    DB_HOST: z.string().min(1),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),

    // JWT
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // Redis
    REDIS_HOST: z.string().min(1).default('localhost'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // Google OAuth
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_CALLBACK_URL: z.url(),

    // Frontend
    FRONTEND_URL: z.url(),

    // Test auth (e2e only — NEVER set in production)
    TEST_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
    TEST_AUTH_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.TEST_AUTH_ENABLED !== 'true') return;

    if (env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['TEST_AUTH_ENABLED'],
        message: 'TEST_AUTH_ENABLED no puede ser true en NODE_ENV=production',
      });
    }

    if (!env.TEST_AUTH_SECRET || env.TEST_AUTH_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['TEST_AUTH_SECRET'],
        message: 'TEST_AUTH_SECRET debe tener al menos 32 caracteres cuando TEST_AUTH_ENABLED=true',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
