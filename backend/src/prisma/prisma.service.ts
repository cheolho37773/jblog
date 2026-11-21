import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';
import { createPrismaAdapter } from './prisma-adapter';

// 앱 전체가 함께 쓰는 Prisma 클라이언트 (백엔드 §2: Controller → Service → PrismaService).
// 부팅 시 $connect를 부르지 않는다: 첫 쿼리 때 연결하므로 DB가 없어도 앱이 뜨고 /api/health가 실패를 보고한다.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // 접속 URL은 검증된 AppEnv(ConfigService)에서만 받는다 (개요 §6-b).
  constructor(config: ConfigService<AppEnv, true>) {
    super({ adapter: createPrismaAdapter(config.get('DATABASE_URL', { infer: true })) });
  }

  // app.enableShutdownHooks()가 종료 신호를 받으면 Nest가 이 훅을 불러 연결 풀을 닫는다.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
