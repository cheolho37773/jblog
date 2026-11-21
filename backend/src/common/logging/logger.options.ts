import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { AppEnv } from '../../config/env.validation';

export const REQUEST_ID_HEADER = 'x-request-id';
const REDACTED = '[Redacted]';
// 인증 정보가 로그에 남지 않게 한다(개요 §6-b).
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

// 들어온 요청 ID를 이어 쓰면 프록시·프론트와 로그를 묶어 볼 수 있다.
function resolveRequestId(request: IncomingMessage, response: ServerResponse): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  const requestId = typeof incoming === 'string' && incoming !== '' ? incoming : randomUUID();
  response.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}

export function createLoggerParams(env: AppEnv, stream?: NodeJS.WritableStream): Params {
  const options = {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    genReqId: resolveRequestId,
    redact: { paths: REDACT_PATHS, censor: REDACTED },
  };
  return { pinoHttp: stream ? [options, stream] : options };
}
