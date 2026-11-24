import { ApiProperty } from '@nestjs/swagger';
import { PostSummaryDto } from './post-summary.dto';
import { TagRefDto } from './tag-ref.dto';

// 공개 상세. 원문(contentMd)·version은 여기에 없다 — InternalPostDto에만 더한다(백엔드 §4.2).
export class PostDetailDto extends PostSummaryDto {
  @ApiProperty({ type: [TagRefDto] })
  tags!: TagRefDto[];

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty({ type: String, nullable: true })
  seoTitle!: string | null;

  @ApiProperty({ type: String, nullable: true })
  seoDescription!: string | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
