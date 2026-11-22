import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet, { type HelmetOptions } from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule, type AppModuleOptions } from './app.module';
import { requestIdMiddleware } from './common/logging/logger.options';
import { createValidationFailedException } from './common/errors/validation-failed';
import { type AppEnv, validateEnv } from './config/env.validation';

export type CreateAppOptions = AppModuleOptions;

const GLOBAL_PREFIX = 'api';
const SWAGGER_PATH = `${GLOBAL_PREFIX}/docs`;

const API_TITLE = 'jblog API';
const API_VERSION = '1.0.0';

// /api/docs와 backend/openapi.json(openapi:generate)이 같은 문서 정보를 쓰도록 한 곳에서 만든다.
export function createApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle(API_TITLE).setVersion(API_VERSION).build();
  return SwaggerModule.createDocument(app, config);
}

function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, createApiDocument(app));
}

// helmet 기본 CSP의 upgrade-insecure-requests는 운영(HTTPS 전제)에서만 둔다.
// Safari(WebKit)는 localhost에도 이 지시어를 적용해 http://localhost의 Swagger UI 정적 파일을
// https://로 요청하다 TLS 오류로 흰 화면이 된다(Issue #37). null은 helmet 기본 지시어를 뺀다는 뜻이다.
export function createHelmetOptions(env: AppEnv): HelmetOptions {
  if (env.NODE_ENV === 'production') return {};
  return {
    contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } },
  };
}

function applyHttpSettings(app: INestApplication, env: AppEnv): void {
  app.use(requestIdMiddleware);
  app.use(helmet(createHelmetOptions(env)));
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
