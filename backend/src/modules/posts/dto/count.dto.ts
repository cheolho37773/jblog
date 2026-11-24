import { ApiProperty } from '@nestjs/swagger';

export class CategoryWithCountDto {
  @ApiProperty({ example: '백엔드' })
  name!: string;

  @ApiProperty({ example: 'backend' })
  slug!: string;

  @ApiProperty({ description: '발행된 글 수', example: 0 })
  postCount!: number;
}

export class TagWithCountDto {
  @ApiProperty({ example: 'NestJS' })
  name!: string;

  @ApiProperty({ example: 'nestjs' })
  slug!: string;

  @ApiProperty({ description: '발행된 글 수', example: 0 })
  postCount!: number;
}
