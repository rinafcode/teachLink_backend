import { SelectQueryBuilder } from 'typeorm';
import { PaginationQueryDto } from '../dto/pagination.dto';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export async function paginate<T>(
  queryBuilder: SelectQueryBuilder<T>,
  options: PaginationQueryDto,
): Promise<PaginatedResponse<T>> {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const skip = (page - 1) * limit;

  // Apply sorting
  if (options.sortBy) {
    const alias = queryBuilder.alias;
    queryBuilder.orderBy(`${alias}.${options.sortBy}`, options.order);
  }

  // Clone query to get count without pagination limits
  const totalItems = await queryBuilder.getCount();

  // Apply pagination
  const data = await queryBuilder.skip(skip).take(limit).getMany();

  const totalPages = Math.ceil(totalItems / limit);

  return {
    data,
    meta: {
      totalItems,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages,
      currentPage: page,
    },
  };
}
