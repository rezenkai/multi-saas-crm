import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { Auth0Module } from './auth0/auth0.module';
import auth0Config from './config/auth0.config';
import databaseConfig from './config/database.config';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, auth0Config],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database module
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get('database');
        if (!dbConfig) {
          throw new Error('Database configuration not found');
        }
        return dbConfig;
      },
      inject: [ConfigService],
    }),

    // Feature modules
    UserModule,
    AuthModule,
    TwoFactorModule,
    Auth0Module,

    // TODO: Add these modules later
    // AuthModule,
    // TwoFactorModule,
    // Auth0Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
