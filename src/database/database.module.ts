import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        database: config.get<string>('db.name'),
        username: config.get<string>('db.user'),
        password: config.get<string>('db.password'),
        entities: [__dirname + '/../**/*.orm-entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        migrationsRun: false,
        logging: config.get<string>('app.nodeEnv') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
