import { ApiProperty } from '@nestjs/swagger';

export class CategoryRefDto {
  @ApiProperty({ example: '백엔드' })
  name!: string;

  @ApiProperty({ example: 'backend' })
  slug!: string;
}
