import { HttpStatus, type ValidationError } from '@nestjs/common';
import { AppException } from './app.exception';

export const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';

function collectMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectMessages(error.children ?? []),
  ]);
}

// ValidationPipe의 exceptionFactory. 메시지에는 규칙 설명만 담고 입력값은 담지 않는다.
export function createValidationFailedException(errors: ValidationError[]): AppException {
  return new AppException(
    HttpStatus.BAD_REQUEST,
    VALIDATION_FAILED_CODE,
    collectMessages(errors).join('; '),
  );
}
