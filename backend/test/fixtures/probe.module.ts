import { Body, Controller, Get, HttpStatus, Module, Post, Res } from '@nestjs/common';
import { IsString } from 'class-validator';
import type { Response } from 'express';
import { AppException } from '../../src/common/errors/app.exception';

export const PROBE_APP_ERROR = {
  status: HttpStatus.CONFLICT,
  code: 'POST_CHANGED',
  message: 'Post changed',
};
export const PROBE_INTERNAL_ERROR_MESSAGE = 'internal-secret-detail-7c21';
export const PROBE_SET_COOKIE_VALUE = 'session=probe-set-cookie-value-51d';

class ProbeBodyDto {
  @IsString()
  title!: string;
}

@Controller('probe')
class ProbeController {
  @Get('app-error')
  throwAppException(): never {
    throw new AppException(PROBE_APP_ERROR.status, PROBE_APP_ERROR.code, PROBE_APP_ERROR.message);
  }

  @Get('unknown-error')
  throwUnknownError(): never {
    throw new Error(PROBE_INTERNAL_ERROR_MESSAGE);
  }

  @Post('validate')
  validate(@Body() body: ProbeBodyDto): { title: string } {
    return { title: body.title };
  }

  @Get('set-cookie')
  setCookie(@Res({ passthrough: true }) response: Response): { ok: boolean } {
    response.setHeader('Set-Cookie', PROBE_SET_COOKIE_VALUE);
    return { ok: true };
  }
}

// createApp 의 imports 옵션으로 넘기는 테스트 전용 모듈
@Module({ controllers: [ProbeController] })
export class ProbeModule {}
