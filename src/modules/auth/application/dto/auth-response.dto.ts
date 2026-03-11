import { ApiProperty } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty({ description: 'JWT de acceso (vida corta, 15m)', example: 'eyJhbGci...' })
  accessToken: string;
}
