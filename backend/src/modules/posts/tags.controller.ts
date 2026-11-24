import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createNotImplementedException } from '../../common/errors/not-implemented';
import { TagWithCountDto } from './dto/count.dto';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  @Get()
  @ApiOperation({ summary: '태그 목록 (발행 글 수 포함)' })
  @ApiOkResponse({ type: [TagWithCountDto] })
  list(): TagWithCountDto[] {
    throw createNotImplementedException();
  }
}
