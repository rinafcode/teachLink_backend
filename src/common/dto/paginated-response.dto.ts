import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function PaginatedSwaggerDto<T>(classRef: new (...args: any[]) => T) {
  class PaginatedSwaggerType {
    @ApiProperty({ type: [classRef] })
    data: T[];

    @ApiProperty({ type: Number })
    total: number;

    @ApiProperty({ type: Number })
    page: number;

    @ApiProperty({ type: Number })
    limit: number;

    @ApiProperty({ type: Number })
    totalPages: number;

    @ApiProperty({ type: Boolean })
    hasNextPage: boolean;

    @ApiProperty({ type: Boolean })
    hasPrevPage: boolean;
  }

  Object.defineProperty(PaginatedSwaggerType, 'name', {
    value: `Paginated${classRef.name}Response`,
  });

  return PaginatedSwaggerType as unknown as new () => PaginatedResponseDto<T>;
}
