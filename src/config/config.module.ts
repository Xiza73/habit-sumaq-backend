import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import {
  appConfig,
  dbConfig,
  googleConfig,
  jwtConfig,
  redisConfig,
  testAuthConfig,
} from './app.config';
import { envSchema } from './env.schema';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, dbConfig, jwtConfig, googleConfig, redisConfig, testAuthConfig],
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);

        if (!result.success) {
          const errors = result.error.issues
            .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

          throw new Error(`Variables de entorno inválidas:\n${errors}`);
        }

        return result.data;
      },
    }),
  ],
})
export class ConfigModule {}
