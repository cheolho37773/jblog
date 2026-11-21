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
  return HttpStatus[exception.getStatus()] ?? 'ERROR';
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
    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();
    if (exception instanceof HttpException) {
      return {
        statusCode: exception.getStatus(),
        code: resolveCode(exception),
        message: exception.message,
        path,
        timestamp,
      };
    }

    this.logger.error({ err: exception }, 'Unhandled exception');
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: INTERNAL_ERROR_CODE,
      message: INTERNAL_ERROR_MESSAGE,
      path,
      timestamp,
    };
  }
}
