import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import './shared/config/env.config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './shared/globals/global-exception.filter';
import { ExcludeTimestampInterceptor } from './shared/globals/exclude-timestamps.interceptor';
import dns from "node:dns"
async function bootstrap() {

  dns.setDefaultResultOrder('ipv4first')

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ExcludeTimestampInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Triage Flow OPD BACKEND SYSTEM')
    .setDescription('A project for seb201 subject in FPT University')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  const customerConfig = {
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.29.1/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.29.1/swagger-ui-bundle.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.29.1/swagger-ui-standalone-preset.js',
    ],
  };
  SwaggerModule.setup('api-docs', app, documentFactory, customerConfig);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
