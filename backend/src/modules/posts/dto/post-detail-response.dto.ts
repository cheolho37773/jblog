import { ApiProperty } from '@nestjs/swagger';
import { PostDetailDto } from './post-detail.dto';
import { PostLinkDto } from './post-link.dto';
import { PostSummaryDto } from './post-summary.dto';

export const MAX_RELATED_POSTS = 3;

// prev는 더 오래된 글, next는 더 최근 글(publishedAt 기준).
export class PostDetailResponseDto {
  @ApiProperty({ type: () => PostDetailDto })
  post!: PostDetailDto;

  @ApiProperty({ type: () => PostLinkDto, nullable: true })
  prev!: PostLinkDto | null;

  @ApiProperty({ type: () => PostLinkDto, nullable: true })
  next!: PostLinkDto | null;

  @ApiProperty({ type: [PostSummaryDto], maxItems: MAX_RELATED_POSTS })
  related!: PostSummaryDto[];
}
