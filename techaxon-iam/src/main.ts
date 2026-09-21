import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';

import { CouchDbService } from './infrastructure/couchdb/couchdb.service';
import { MigrationRunner } from './infrastructure/couchdb/migrations/migration.runner';

async function bootstrap() {
  // Cast to NestExpressApplication to access Express MVC methods
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      console.log(
        `[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms origin=${req.headers.origin ?? '-'} userAgent=${req.headers['user-agent'] ?? '-'}`,
      );
    });
    next();
  });

  const couchDbService = app.get(CouchDbService);
  await couchDbService.initialize();

  const migrationRunner = app.get(MigrationRunner);
  await migrationRunner.run();

  // Enable CORS for client applications (e.g. Next.js on localhost:3001, LMS, Kanban, Shop)
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const allowedPatterns = [
        /^http:\/\/localhost:(3000|3001|8080)$/,
        /^https?:\/\/.*\.techaxon\.localhost(:[0-9]+)?$/,
        /^https?:\/\/.*\.techaxon\.de$/,
        /^https?:\/\/.*\.techaxon\.com$/,
        /^https?:\/\/.*\.example\.com$/,
        /^https?:\/\/.*\.app\.github\.dev$/,
      ];
      const isAllowed = allowedPatterns.some((pattern) => pattern.test(origin));
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' is not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cookie'],
  });

  // Cookie Parser for reading SSO cookies
  app.use(cookieParser());

  // Global DTO Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configure Static Assets (CSS, JS, Images) & Handlebars Views
  app.useStaticAssets(join(process.cwd(), 'public'));
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('hbs');

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
