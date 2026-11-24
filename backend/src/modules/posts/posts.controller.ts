import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { createNotImplementedException } from '../../common/errors/not-implemented';
import { ErrorResponseDto } from '../../common/errors/error-response.dto';
import { PostDetailResponseDto } from './dto/post-detail-response.dto';
import { PostListResponseDto } from './dto/post-list-response.dto';
import { PostListQueryDto } from './dto/post-queries.dto';

// 공개 글 조회 API 계약(백엔드 §4.2). 조회 로직은 M2-03에서 구현하므로 지금은 501이다.
@ApiTags('posts')
@Controller('posts')
export class PostsController {
  @Get()
  @ApiOperation({ summary: '발행된 글 목록' })
  @ApiOkResponse({ type: PostListResponseDto })
  @ApiBadRequestResponse({
    description: '쿼리 검증 실패 (VALIDATION_FAILED)',
    type: ErrorResponseDto,
  })
  // 쿼리 DTO는 문서·검증용이다. 조회 구현(M2-03) 전까지 값을 쓰지 않는다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  list(@Query() _query: PostListQueryDto): PostListResponseDto {
    throw createNotImplementedException();
  }

  @Get(':slug')
  @ApiOperation({ summary: '글 상세 (이전·다음 글, 관련 글 포함)' })
  @ApiParam({ name: 'slug', description: '글 slug' })
  @ApiOkResponse({ type: PostDetailResponseDto })
  @ApiResponse({
    status: 301,
    description: '이전 slug로 요청함. Location 헤더가 새 경로를 가리킨다',
  })
  @ApiNotFoundResponse({ description: '글 없음 (POST_NOT_FOUND)', type: ErrorResponseDto })
  detail(): PostDetailResponseDto {
    throw createNotImplementedException();
  }
}
