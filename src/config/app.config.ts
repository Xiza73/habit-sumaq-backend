import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.PORT),
  appUrl: process.env.APP_URL,
  frontendUrl: process.env.FRONTEND_URL,
}));

export const dbConfig = registerAs('db', () => ({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  name: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
}));

export const googleConfig = registerAs('google', () => ({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackUrl: process.env.GOOGLE_CALLBACK_URL,
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
}));

export const testAuthConfig = registerAs('testAuth', () => ({
  enabled: process.env.TEST_AUTH_ENABLED === 'true',
  secret: process.env.TEST_AUTH_SECRET,
}));
