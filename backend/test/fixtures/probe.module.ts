import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Module,
  Post,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
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

export const PROBE_HTTP_5XX_MESSAGE = 'http-5xx-internal-detail-3e8';
export const PROBE_APP_500_CODE = 'SOME_CODE';

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

  @Get('internal-server-error')
  throwInternalServerError(): never {
    throw new InternalServerErrorException(PROBE_HTTP_5XX_MESSAGE);
  }

  @Get('http-500')
  throwHttp500(): never {
    throw new HttpException(PROBE_HTTP_5XX_MESSAGE, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Get('app-500')
  throwAppException500(): never {
    throw new AppException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      PROBE_APP_500_CODE,
      PROBE_HTTP_5XX_MESSAGE,
    );
  }

  @Get('service-unavailable')
  throwServiceUnavailable(): never {
    throw new ServiceUnavailableException(PROBE_HTTP_5XX_MESSAGE);
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
