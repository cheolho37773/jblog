import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createNotImplementedException } from '../../common/errors/not-implemented';
import { ErrorResponseDto } from '../../common/errors/error-response.dto';
import { PostListResponseDto } from './dto/post-list-response.dto';
import { SearchQueryDto } from './dto/post-queries.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  @Get()
  @ApiOperation({ summary: '글 검색 (백엔드 §5.4)' })
  @ApiOkResponse({ type: PostListResponseDto })
  @ApiBadRequestResponse({
    description: '쿼리 검증 실패 (VALIDATION_FAILED)',
    type: ErrorResponseDto,
  })
  // 쿼리 DTO는 문서·검증용이다. 조회 구현(M2-03) 전까지 값을 쓰지 않는다.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  search(@Query() _query: SearchQueryDto): PostListResponseDto {
    throw createNotImplementedException();
  }
}
