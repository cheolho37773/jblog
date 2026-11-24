import { ApiProperty } from '@nestjs/swagger';
import { InternalPostDto } from './internal-post.dto';
import { MAX_RELATED_POSTS } from './post-detail-response.dto';
import { PostLinkDto } from './post-link.dto';
import { PostSummaryDto } from './post-summary.dto';

export class InternalPostResponseDto {
  @ApiProperty({ type: () => InternalPostDto })
  post!: InternalPostDto;

  @ApiProperty({ type: () => PostLinkDto, nullable: true })
  prev!: PostLinkDto | null;

  @ApiProperty({ type: () => PostLinkDto, nullable: true })
  next!: PostLinkDto | null;

  @ApiProperty({ type: [PostSummaryDto], maxItems: MAX_RELATED_POSTS })
  related!: PostSummaryDto[];
}

// 이전 slug로 조회했을 때 새 slug를 알려 준다.
export class InternalPostRedirectDto {
  @ApiProperty({ description: '새 slug', example: 'hello-world' })
  redirectTo!: string;
}
