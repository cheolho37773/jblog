import { ApiProperty } from '@nestjs/swagger';

// 이전·다음 글 링크.
export class PostLinkDto {
  @ApiProperty({ example: 'hello-world' })
  slug!: string;

  @ApiProperty({ example: '첫 번째 글' })
  title!: string;
}
