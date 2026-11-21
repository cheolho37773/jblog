import { ApiProperty } from '@nestjs/swagger';

// 전역 에러 필터가 보내는 공통 에러 본문(백엔드 §4.1)의 OpenAPI 표현.
// 필터의 실제 본문과 같은 5개 필드이며, 에러 응답을 문서화하는 모든 API가 이 타입을 쓴다.
export class ErrorResponseDto {
  @ApiProperty({ example: 503 })
  statusCode!: number;

  @ApiProperty({ example: 'SERVICE_UNAVAILABLE' })
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ example: '/api/health' })
  path!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}
