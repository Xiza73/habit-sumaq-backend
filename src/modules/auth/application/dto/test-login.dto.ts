import { ApiProperty } from '@nestjs/swagger';

import { IsEmail, MaxLength } from 'class-validator';

export class TestLoginDto {
  @ApiProperty({ example: 'e2e@habit-sumaq.test' })
  @IsEmail()
  @MaxLength(254)
  email: string;
}
