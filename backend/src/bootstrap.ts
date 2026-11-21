import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule, type AppModuleOptions } from './app.module';
import { createValidationFailedException } from './common/errors/validation-failed';
import { type AppEnv, validateEnv } from './config/env.validation';

export type CreateAppOptions = AppModuleOptions;

const GLOBAL_PREFIX = 'api';
const SWAGGER_PATH = `${GLOBAL_PREFIX}/docs`;

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder().setTitle('jblog API').build();
  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, config));
}

function applyHttpSettings(app: INestApplication, env: AppEnv): void {
  app.use(helmet());
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: createValidationFailedException,
    }),
  );
  app.enableShutdownHooks();
  // 운영에서는 API 구조를 노출하지 않는다(규약 6).
  if (env.NODE_ENV !== 'production') setupSwagger(app);
}

// listen하지 않는다. 호출 측(main.ts, 테스트)이 init()/listen()을 고른다.
export async function createApp(
  rawEnv: Record<string, unknown>,
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const env = validateEnv(rawEnv);
  const app = await NestFactory.create(AppModule.register(env, options), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  applyHttpSettings(app, env);
  return app;
}
