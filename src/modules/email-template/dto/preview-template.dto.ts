import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PreviewTemplateDto {
  @ApiProperty({
    description: 'Variable values for template rendering',
    example: { userName: 'Alice', verificationLink: 'https://...' },
  })
  @IsObject()
  variables: Record<string, string>;
}
