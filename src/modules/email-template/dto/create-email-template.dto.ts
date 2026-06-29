import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmailTemplateDto {
  @ApiProperty({ description: 'Unique template key', example: 'welcome_email' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Human-readable template name', example: 'Welcome Email' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Email subject line', example: 'Welcome to TeachLink!' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({
    description: 'Email body (HTML or plain text)',
    example: '<h1>Welcome!</h1><p>Get started...</p>',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({
    description: 'Template variable names',
    example: ['userName', 'verificationLink'],
  })
  @IsArray()
  variables: string[];
}
