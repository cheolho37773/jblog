import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createNotImplementedException } from '../../common/errors/not-implemented';
import { CategoryWithCountDto } from './dto/count.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  @Get()
  @ApiOperation({ summary: '카테고리 목록 (sortOrder 순, 발행 글 수 포함)' })
  @ApiOkResponse({ type: [CategoryWithCountDto] })
  list(): CategoryWithCountDto[] {
    throw createNotImplementedException();
  }
}
