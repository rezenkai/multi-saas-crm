import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get config service
  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Get port from config
  const port = configService.get<number>('PORT') || 3003;

  await app.listen(port);

  console.log(`🚀 Notification Service running on port ${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/v1/health`);
  console.log(
    `📧 Multi-channel notifications: http://localhost:${port}/api/v1/notifications`,
  );
  console.log(
    `📱 Supported channels: Email (stub), SMS (stub), Telegram (stub), WhatsApp (stub), Push (stub)`,
  );
}

bootstrap();
