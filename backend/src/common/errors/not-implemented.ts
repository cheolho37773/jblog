import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

export const NOT_IMPLEMENTED_CODE = 'NOT_IMPLEMENTED';

// 계약(OpenAPI)만 먼저 고정하고 구현은 뒤 작업에서 채우는 핸들러가 던진다.
// 빈 200 대신 공통 에러 형식의 501을 보내, 구현 전 호출이 성공처럼 보이지 않게 한다.
export function createNotImplementedException(): AppException {
  return new AppException(HttpStatus.NOT_IMPLEMENTED, NOT_IMPLEMENTED_CODE, 'Not implemented');
}
