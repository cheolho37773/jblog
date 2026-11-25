import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
import { AppException } from '../errors/app.exception';
import { CACHE_CONTROL_NO_STORE } from '../http/cache-control';

const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
// 내부 사정(스택, 원래 메시지)이 새지 않도록 500은 항상 이 문구만 보낸다.
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
}

function resolveCode(exception: HttpException): string {
  if (exception instanceof AppException) return exception.code;
  const status = exception.getStatus();
  if (status === HttpStatus.INTERNAL_SERVER_ERROR) return INTERNAL_ERROR_CODE;
  return HttpStatus[status] ?? 'ERROR';
}

function isNoStore(header: unknown): boolean {
  return typeof header === 'string' && header.includes(CACHE_CONTROL_NO_STORE);
}

function isServerError(status: number): boolean {
  return status >= HttpStatus.INTERNAL_SERVER_ERROR;
}

function requestPath(request: Request): string {
  return request.originalUrl.split('?')[0] ?? request.originalUrl;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const body = this.buildBody(exception, requestPath(request));
    // 핸들러가 성공용 Cache-Control을 미리 붙였더라도 오류 응답은 캐시하지 않는다.
    // 이미 no-store(내부 API의 private, no-store)면 더 구체적인 값을 지우지 않는다.
    if (!isNoStore(response.getHeader('Cache-Control'))) {
      response.setHeader('Cache-Control', CACHE_CONTROL_NO_STORE);
    }
    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();
    if (exception instanceof HttpException && !isServerError(exception.getStatus())) {
      const statusCode = exception.getStatus();
      return {
        statusCode,
        code: resolveCode(exception),
        message: exception.message,
        path,
        timestamp,
      };
    }

    // 5xx는 예외 종류와 관계없이 내부 사정을 응답에 싣지 않고 서버 로그에만 남긴다.
    this.logger.error({ err: exception }, 'Unhandled exception');
    const isHttp = exception instanceof HttpException;
    return {
      statusCode: isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
      code: isHttp ? resolveCode(exception) : INTERNAL_ERROR_CODE,
      message: INTERNAL_ERROR_MESSAGE,
      path,
      timestamp,
    };
  }
}
