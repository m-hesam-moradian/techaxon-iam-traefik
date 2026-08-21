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

  const couchDbService = app.get(CouchDbService);
  await couchDbService.initialize();

  const migrationRunner = app.get(MigrationRunner);
  await migrationRunner.run();

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
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
