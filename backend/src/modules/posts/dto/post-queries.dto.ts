import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 9;
export const MAX_PAGE_SIZE = 50;
export const MIN_SEARCH_QUERY_LENGTH = 2;

// 쿼리스트링의 'true'/'false'만 boolean으로 바꾼다. 그 밖의 값은 그대로 두어 검증에서 거절된다.
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class PageQueryDto {
  @ApiPropertyOptional({ type: 'integer', default: DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  size?: number;
}

export class PostListQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '카테고리 slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '태그 slug' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ type: Boolean, description: '추천 글만' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  featured?: boolean;
}

export class SearchQueryDto extends PageQueryDto {
  @ApiProperty({ minLength: MIN_SEARCH_QUERY_LENGTH, description: '검색어 (2자 이상)' })
  @IsString()
  @MinLength(MIN_SEARCH_QUERY_LENGTH)
  q!: string;
}
