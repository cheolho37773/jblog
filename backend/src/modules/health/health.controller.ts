import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';

// 응답의 검사 이름. 접속 정보(호스트·DB 이름)가 아니라 역할 이름만 쓴다.
const DATABASE_CHECK_KEY = 'database';

// GET /api/health (백엔드 §6). DB에 SELECT 1을 보내 정상이면 200, 아니면 Terminus가 503을 던지고
// 전역 에러 필터가 SERVICE_UNAVAILABLE 형식으로 바꾼다. 실패 원인은 응답에 싣지 않고 로그에만 남는다.
// 인증 없이 호출한다 (M2에서 @Public() 표시).
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prismaHealth.pingCheck(DATABASE_CHECK_KEY, this.prisma)]);
  }
}
