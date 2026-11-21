import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// 모든 모듈이 import 없이 PrismaService를 주입받도록 전역으로 둔다 (백엔드 §2).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
