import { Controller, Get } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { createNotImplementedException } from '../../common/errors/not-implemented';
import { ErrorResponseDto } from '../../common/errors/error-response.dto';
import { InternalPostRedirectDto, InternalPostResponseDto } from './dto/internal-post-response.dto';

export const INTERNAL_KEY_HEADER = 'X-Internal-Key';

// 프론트 서버 전용 원문 조회(백엔드 §4.5). 전역 prefix 밖(/internal/*)에 둔다(bootstrap.ts 참고).
// 키 검증(InternalKeyGuard)과 조회는 M2-04에서 구현하므로 지금은 501이다.
@ApiTags('internal')
@Controller('internal/posts')
export class InternalPostsController {
  @Get(':slug')
  @ApiOperation({ summary: '글 원문 조회 (내부 전용)' })
  @ApiHeader({ name: INTERNAL_KEY_HEADER, required: true, description: '내부 API 키' })
  @ApiParam({ name: 'slug', type: String, description: '글 slug (이전 slug면 redirectTo 응답)' })
  @ApiExtraModels(InternalPostResponseDto, InternalPostRedirectDto)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(InternalPostResponseDto) },
        { $ref: getSchemaPath(InternalPostRedirectDto) },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: '키 없음·불일치 (UNAUTHORIZED)', type: ErrorResponseDto })
  @ApiNotFoundResponse({ description: '글 없음 (POST_NOT_FOUND)', type: ErrorResponseDto })
  detail(): InternalPostResponseDto | InternalPostRedirectDto {
    throw createNotImplementedException();
  }
}
