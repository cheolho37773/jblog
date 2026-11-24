import { ApiProperty } from '@nestjs/swagger';
import { CategoryRefDto } from './category-ref.dto';

// 목록·관련 글에 쓰는 글 요약(백엔드 §4.2).
export class PostSummaryDto {
  @ApiProperty({ example: 'hello-world' })
  slug!: string;

  @ApiProperty({ example: '첫 번째 글' })
  title!: string;

  @ApiProperty()
  excerpt!: string;

  @ApiProperty({ type: String, nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty({ type: () => CategoryRefDto, nullable: true })
  category!: CategoryRefDto | null;

  @ApiProperty({ format: 'date-time', description: '발행 시각 (ISO 8601)' })
  publishedAt!: string;

  @ApiProperty({ example: 5 })
  readingMinutes!: number;

  @ApiProperty({ example: 0 })
  viewCount!: number;

  @ApiProperty({ example: 0 })
  likeCount!: number;
}
