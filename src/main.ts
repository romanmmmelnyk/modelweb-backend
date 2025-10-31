import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Enable raw body for webhook verification
  });

  // Enable global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Set global API prefix
  app.setGlobalPrefix('api');

  // Enable CORS with origins from environment variables
  const corsOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:5173',  // Default: Vite default port
        'http://localhost:8200',  // Default: Frontend development server
        'http://localhost:3000',  // Default: Alternative frontend port
        'http://localhost:9101',  // Default: Apply website
      ];

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Token'],
    credentials: true,
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  await app.listen(process.env.PORT ?? 8210, '0.0.0.0', () => {
    console.log(`✅ Backend server ready on port ${process.env.PORT ?? 8210}`);
    // Send ready signal to PM2 if not in watch mode
    if (process.send) {
      process.send('ready');
    }
  });
}
bootstrap();