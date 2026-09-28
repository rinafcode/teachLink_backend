import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T> {
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  cursor?: string;
  nextCursor?: string | null;
}

export function PaginatedSwaggerDto<T>(classRef: new (...args: any[]) => T) {
  class PaginatedSwaggerType {
    @ApiProperty({ type: [classRef] })
    data: T[];

    @ApiProperty({ type: Number, required: false })
    total?: number;

    @ApiProperty({ type: Number, required: false })
    page?: number;

    @ApiProperty({ type: Number, required: false })
    limit?: number;

    @ApiProperty({ type: Number, required: false })
    totalPages?: number;

    @ApiProperty({ type: Boolean, required: false })
    hasNextPage?: boolean;

    @ApiProperty({ type: Boolean, required: false })
    hasPrevPage?: boolean;

    @ApiProperty({ type: String, required: false })
    cursor?: string;

    @ApiProperty({ type: String, nullable: true, required: false })
    nextCursor?: string | null;
  }

  Object.defineProperty(PaginatedSwaggerType, 'name', {
    value: `Paginated${classRef.name}Response`,
  });

  return PaginatedSwaggerType as unknown as new () => PaginatedResponseDto<T>;
}
