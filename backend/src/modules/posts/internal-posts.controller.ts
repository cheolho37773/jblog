import { Controller, Get, HttpStatus, Param, UseGuards } from '@nestjs/common';
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
import { AppException } from '../../common/errors/app.exception';
import { INTERNAL_KEY_HEADER, InternalKeyGuard } from '../../common/guards/internal-key.guard';
import { ErrorResponseDto } from '../../common/errors/error-response.dto';
import { InternalPostRedirectDto, InternalPostResponseDto } from './dto/internal-post-response.dto';
import { InternalPostsService } from './internal-posts.service';
import { POST_NOT_FOUND_CODE } from './posts.controller';

// 프론트 서버 전용 원문 조회(백엔드 §4.5). 전역 prefix 밖(/internal/*)에 둔다(bootstrap.ts 참고).
// 가드가 먼저 돌아 키가 틀리면 slug 존재 여부와 관계없이 401이다.
@ApiTags('internal')
@Controller('internal/posts')
@UseGuards(InternalKeyGuard)
export class InternalPostsController {
  constructor(private readonly posts: InternalPostsService) {}

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
  async detail(
    @Param('slug') slug: string,
  ): Promise<InternalPostResponseDto | InternalPostRedirectDto> {
    const result = await this.posts.getDetail(slug);
    if (result.kind === 'missing') {
      throw new AppException(HttpStatus.NOT_FOUND, POST_NOT_FOUND_CODE, 'Post not found');
    }
    if (result.kind === 'moved') return { redirectTo: result.currentSlug };
    return result.detail;
  }
}
