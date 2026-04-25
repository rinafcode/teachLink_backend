import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTranslationDto {
  @ApiProperty({ example: 'errors' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  namespace: string;

  @ApiProperty({ example: 'not_found' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  key: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  locale: string;

  @ApiProperty({ example: 'Resource was not found.' })
  @IsString()
  @IsNotEmpty()
  value: string;
}
