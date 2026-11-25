import { createHash, timingSafeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AppEnv } from '../../config/env.validation';
import { AppException } from '../errors/app.exception';
import { CACHE_CONTROL_PRIVATE_NO_STORE } from '../http/cache-control';

export const INTERNAL_KEY_HEADER = 'X-Internal-Key';
const UNAUTHORIZED_CODE = 'UNAUTHORIZED';

// 해시하면 길이가 항상 같아져, 길이가 다른 값도 timingSafeEqual(길이가 같아야 함)로 안전하게 비교한다.
function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

// 프론트 서버 전용 /internal/* 보호 (백엔드 §5.6). 내부 컨트롤러에만 붙인다.
@Injectable()
export class InternalKeyGuard implements CanActivate {
  private readonly expectedKeyHash: Buffer;

  constructor(config: ConfigService<AppEnv, true>) {
    this.expectedKeyHash = sha256(config.get('INTERNAL_API_KEY', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    // 가드는 핸들러보다 먼저 돌므로 여기서 붙이면 200·401·404가 모두 private, no-store다.
    http.getResponse<Response>().setHeader('Cache-Control', CACHE_CONTROL_PRIVATE_NO_STORE);

    const provided = http.getRequest<Request>().header(INTERNAL_KEY_HEADER);
    if (!this.isValidKey(provided)) {
      // 키 값이나 어디서 달랐는지는 메시지에 담지 않는다.
      throw new AppException(HttpStatus.UNAUTHORIZED, UNAUTHORIZED_CODE, 'Unauthorized');
    }
    return true;
  }

  private isValidKey(provided: string | undefined): boolean {
    if (provided === undefined || provided === '') return false;
    return timingSafeEqual(sha256(provided), this.expectedKeyHash);
  }
}
