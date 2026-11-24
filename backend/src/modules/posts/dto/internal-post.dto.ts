import { ApiProperty } from '@nestjs/swagger';
import { PostDetailDto } from './post-detail.dto';

// 내부(/internal) 전용. 공개 DTO에는 이 필드들이 없어야 한다.
export class InternalPostDto extends PostDetailDto {
  @ApiProperty({ description: '마크다운 원문' })
  contentMd!: string;

  @ApiProperty({ example: 1 })
  version!: number;
}
