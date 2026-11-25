import { type INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet, { type HelmetOptions } from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule, type AppModuleOptions } from './app.module';
import { GLOBAL_PREFIX } from './common/http/global-prefix';
import { requestIdMiddleware } from './common/logging/logger.options';
import { createValidationFailedException } from './common/errors/validation-failed';
import { type AppEnv, validateEnv } from './config/env.validation';
import { serveSeedAssets } from './dev-static-assets';

export type CreateAppOptions = AppModuleOptions;

// 내부 API(/internal/*)는 프론트 서버만 부르는 경로라 공개 API(/api)와 prefix를 나눈다.
// 그래야 /api/internal/*가 404가 되고, 문서 경로도 /internal/posts/{slug}로 나온다(백엔드 §4.5).
const INTERNAL_ROUTES = [{ path: 'internal/posts/:slug', method: RequestMethod.GET }];
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

function applyHttpSettings(app: NestExpressApplication, env: AppEnv): void {
  app.use(requestIdMiddleware);
  app.use(helmet(createHelmetOptions(env)));
  app.setGlobalPrefix(GLOBAL_PREFIX, { exclude: INTERNAL_ROUTES });
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
  // 시드 커버 이미지는 개발에서만 api가 서빙한다. 운영은 Nginx가 /uploads를 맡는다(M2-03 규약 8).
  if (env.NODE_ENV !== 'production') serveSeedAssets(app);
}

// listen하지 않는다. 호출 측(main.ts, 테스트)이 init()/listen()을 고른다.
export async function createApp(
  rawEnv: Record<string, unknown>,
  options: CreateAppOptions = {},
): Promise<INestApplication> {
  const env = validateEnv(rawEnv);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env, options), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  applyHttpSettings(app, env);
  return app;
}
