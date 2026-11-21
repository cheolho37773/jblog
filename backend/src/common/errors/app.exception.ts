import { HttpException, HttpStatus } from '@nestjs/common';

// 앱이 직접 던지는 예외. 에러 응답의 code를 호출 측이 정한다(백엔드 §4.1).
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
  ) {
    super(message, status);
  }
}
