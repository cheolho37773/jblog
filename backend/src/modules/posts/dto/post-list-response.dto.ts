import { ApiProperty } from '@nestjs/swagger';
import { PostSummaryDto } from './post-summary.dto';

// 목록 응답 공통 형식(백엔드 §4.1).
export class PostListResponseDto {
  @ApiProperty({ type: [PostSummaryDto] })
  items!: PostSummaryDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 9 })
  size!: number;

  @ApiProperty({ example: 0 })
  totalItems!: number;

  @ApiProperty({ example: 0 })
  totalPages!: number;
}
