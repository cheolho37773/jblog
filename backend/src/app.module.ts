import { type DynamicModule, Module, type ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createLoggerParams } from './common/logging/logger.options';
import type { AppEnv } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

export type ModuleImports = NonNullable<ModuleMetadata['imports']>;

export interface AppModuleOptions {
  imports?: ModuleImports;
  logStream?: NodeJS.WritableStream;
}

@Module({})
export class AppModule {
  // 검증이 끝난 환경값을 받아 구성한다. 주변 process.env에 의존하지 않기 위해
  // ConfigModule은 환경변수·.env 파일을 읽지 않고 이 값만 싣는다.
  static register(env: AppEnv, options: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          load: [() => ({ ...env })],
        }),
        LoggerModule.forRoot(createLoggerParams(env, options.logStream)),
        PrismaModule,
        HealthModule,
        ...(options.imports ?? []),
      ],
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    };
  }
}
