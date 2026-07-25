import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from './entities/user.entity';
import { UsersService } from './users.service';
import { UserAdminDto } from './dto/user-admin.dto';
import { UserPublicDto } from './dto/user-public.dto';

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
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
  @ApiResponse({ status: 200, description: 'Search results for users' })
  async search(
    @Request() req: { user?: { role?: string } },
    @Query('q') query?: string,
    @Query('role') role?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<unknown> {
    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number(limit) > 0 ? Number(limit) : 20;
    const searchRole = role ? role.toLowerCase() : undefined;

    const results = await this.usersService.searchUsers(query, searchRole, pageNum, limitNum);
    const isAdmin = req.user?.role === UserRole.ADMIN;

    return instanceToPlain(
      plainToInstance(isAdmin ? UserAdminDto : UserPublicDto, results, {
        excludeExtraneousValues: true,
      }),
    );
  }
}
