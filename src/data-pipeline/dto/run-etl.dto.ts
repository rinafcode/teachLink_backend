import { IsArray, IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RunEtlDto {
  @ApiProperty({ description: 'Data source identifier', example: 'sales_csv' })
  @IsString()
  source: string;

  @ApiProperty({
    description: 'Array of records to process',
    example: [{ id: 1, name: 'example' }],
  })
  @IsArray()
  @IsObject({ each: true })
  data: Record<string, unknown>[];
}
