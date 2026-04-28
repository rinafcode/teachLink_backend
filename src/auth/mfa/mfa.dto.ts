import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmMfaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP token from authenticator app' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class VerifyMfaDto {
  @ApiProperty({ example: '123456', description: 'TOTP token or backup code' })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class DisableMfaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP token to confirm disable' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  token: string;
}
