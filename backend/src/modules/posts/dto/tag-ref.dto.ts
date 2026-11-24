import { ApiProperty } from '@nestjs/swagger';

export class TagRefDto {
  @ApiProperty({ example: 'NestJS' })
  name!: string;

  @ApiProperty({ example: 'nestjs' })
  slug!: string;
}
