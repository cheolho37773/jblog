import { ApiProperty } from '@nestjs/swagger';

// 검사 이름(예: database) → 검사 결과. 결과 안의 필드는 검사 종류마다 달라 자유 형식으로 둔다.
const INDICATOR_RESULTS_SCHEMA = {
  type: 'object',
  additionalProperties: { type: 'object', additionalProperties: true },
} as const;

// GET /api/health 200 본문(Terminus 형식)의 OpenAPI 표현.
export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: string;

  @ApiProperty({ ...INDICATOR_RESULTS_SCHEMA, example: { database: { status: 'up' } } })
  info!: Record<string, Record<string, unknown>>;

  @ApiProperty({ ...INDICATOR_RESULTS_SCHEMA, example: {} })
  error!: Record<string, Record<string, unknown>>;

  @ApiProperty({ ...INDICATOR_RESULTS_SCHEMA, example: { database: { status: 'up' } } })
  details!: Record<string, Record<string, unknown>>;
}
