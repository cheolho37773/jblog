import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { ErrorResponseDto } from '../../common/errors/error-response.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthResponseDto } from './health-response.dto';

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
  // Terminus 기본 문서는 503 본문을 status/details로 적는데 실제 본문은 공통 에러 형식이므로
  // 기본 문서를 끄고 200·503을 직접 적는다.
  @ApiOkResponse({ description: 'DB 연결 정상', type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ description: 'DB 연결 실패', type: ErrorResponseDto })
  @HealthCheck({ swaggerDocumentation: false })
  check() {
    return this.health.check([() => this.prismaHealth.pingCheck(DATABASE_CHECK_KEY, this.prisma)]);
  }
}
