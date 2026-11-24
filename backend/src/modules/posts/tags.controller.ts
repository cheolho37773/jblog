import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CACHE_CONTROL_PUBLIC } from '../../common/http/cache-control';
import { TagWithCountDto } from './dto/count.dto';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get()
  @Header('Cache-Control', CACHE_CONTROL_PUBLIC)
  @ApiOperation({ summary: '태그 목록 (발행 글 수 포함)' })
  @ApiOkResponse({ type: [TagWithCountDto] })
  list(): Promise<TagWithCountDto[]> {
    return this.taxonomy.listTags();
  }
}
