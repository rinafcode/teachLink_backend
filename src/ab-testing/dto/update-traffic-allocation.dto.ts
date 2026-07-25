import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmptyObject, IsObject } from 'class-validator';

/**
 * Request DTO for updating experiment traffic allocation.
 */
export class UpdateTrafficAllocationDto {
  @ApiProperty({
    description: 'A mapping of variant IDs to traffic allocation percentages.',
    example: { 'variant-1': 50, 'variant-2': 50 },
  })
  @IsObject({ message: 'Traffic allocations must be an object' })
  @IsNotEmptyObject({ nullable: false }, { message: 'Traffic allocations must not be empty' })
  allocations: Record<string, number>;
}
