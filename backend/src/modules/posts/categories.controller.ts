import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CACHE_CONTROL_PUBLIC } from '../../common/http/cache-control';
import { CategoryWithCountDto } from './dto/count.dto';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get()
  @Header('Cache-Control', CACHE_CONTROL_PUBLIC)
  @ApiOperation({ summary: '카테고리 목록 (sortOrder 순, 발행 글 수 포함)' })
  @ApiOkResponse({ type: [CategoryWithCountDto] })
  list(): Promise<CategoryWithCountDto[]> {
    return this.taxonomy.listCategories();
  }
}
