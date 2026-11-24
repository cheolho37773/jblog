import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CACHE_CONTROL_SEARCH } from '../../common/http/cache-control';
import { ErrorResponseDto } from '../../common/errors/error-response.dto';
import { PostListResponseDto } from './dto/post-list-response.dto';
import { SearchQueryDto } from './dto/post-queries.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Header('Cache-Control', CACHE_CONTROL_SEARCH)
  @ApiOperation({ summary: '글 검색 (백엔드 §5.4)' })
  @ApiOkResponse({ type: PostListResponseDto })
  @ApiBadRequestResponse({
    description: '쿼리 검증 실패 (VALIDATION_FAILED)',
    type: ErrorResponseDto,
  })
  search(@Query() query: SearchQueryDto): Promise<PostListResponseDto> {
    return this.searchService.search(query);
  }
}
