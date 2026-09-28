import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserAdminDto } from './dto/user-admin.dto';
import { UserPublicDto } from './dto/user-public.dto';
import { GetUsersDto } from './dto/get-users.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search users' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by name, username, or email' })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'Filter by user role',
    enum: [
      UserRole.STUDENT,
      UserRole.TEACHER,
      UserRole.INSTRUCTOR,
      UserRole.MODERATOR,
      UserRole.ADMIN,
    ],
  })
  @ApiResponse({ status: 200, description: 'Search results for users' })
  async search(
    @Request() req: { user?: { role?: string } },
    @Query() pagination: GetUsersDto,
  ): Promise<unknown> {
    const searchRole = pagination.role?.toLowerCase();

    const results = await this.usersService.searchUsers(
      pagination.q,
      searchRole,
      pagination.page,
      pagination.limit,
    );
    const isAdmin = req.user?.role === UserRole.ADMIN;

    return instanceToPlain(
      plainToInstance(isAdmin ? UserAdminDto : UserPublicDto, results, {
        excludeExtraneousValues: true,
      }),
    );
  }
}
