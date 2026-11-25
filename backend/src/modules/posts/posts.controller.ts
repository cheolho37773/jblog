import { Controller, Get, Header, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AppException } from '../../common/errors/app.exception';
import { ErrorResponseDto } from '../../common/errors/error-response.dto';
import { GLOBAL_PREFIX } from '../../common/http/global-prefix';
import { CACHE_CONTROL_NO_STORE, CACHE_CONTROL_PUBLIC } from '../../common/http/cache-control';
import { PostDetailResponseDto } from './dto/post-detail-response.dto';
import { PostListResponseDto } from './dto/post-list-response.dto';
import { PostListQueryDto } from './dto/post-queries.dto';
import { PostsService } from './posts.service';

export const POST_NOT_FOUND_CODE = 'POST_NOT_FOUND';
const PUBLIC_POSTS_PATH = `/${GLOBAL_PREFIX}/posts`;

// 공개 글 조회 API (백엔드 §4.2). 조회 로직은 PostsService에 있고 여기서는 HTTP 형태만 정한다.
@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @Header('Cache-Control', CACHE_CONTROL_PUBLIC)
  @ApiOperation({ summary: '발행된 글 목록' })
  @ApiOkResponse({ type: PostListResponseDto })
  @ApiBadRequestResponse({
    description: '쿼리 검증 실패 (VALIDATION_FAILED)',
    type: ErrorResponseDto,
  })
  list(@Query() query: PostListQueryDto): Promise<PostListResponseDto> {
    return this.posts.list(query);
  }

  @Get(':slug')
  @Header('Cache-Control', CACHE_CONTROL_PUBLIC)
  @ApiOperation({ summary: '글 상세 (이전·다음 글, 관련 글 포함)' })
  @ApiParam({ name: 'slug', type: String, description: '글 slug' })
  @ApiOkResponse({ type: PostDetailResponseDto })
  @ApiResponse({
    status: 301,
    description: '이전 slug로 요청함. Location 헤더가 새 경로를 가리킨다',
  })
  @ApiNotFoundResponse({ description: '글 없음 (POST_NOT_FOUND)', type: ErrorResponseDto })
  async detail(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PostDetailResponseDto | undefined> {
    const result = await this.posts.getDetail(slug);
    if (result.kind === 'missing') {
      throw new AppException(HttpStatus.NOT_FOUND, POST_NOT_FOUND_CODE, 'Post not found');
    }
    if (result.kind === 'moved') {
      // 301은 본문 없이 새 경로만 알린다. 이전 slug는 언제든 다시 바뀔 수 있어 캐시하지 않는다.
      response
        .status(HttpStatus.MOVED_PERMANENTLY)
        .setHeader('Location', `${PUBLIC_POSTS_PATH}/${encodeURIComponent(result.currentSlug)}`)
        .setHeader('Cache-Control', CACHE_CONTROL_NO_STORE);
      return undefined;
    }
    return result.detail;
  }
}
