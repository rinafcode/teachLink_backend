import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkUpdateUsersDto, BulkDeleteUsersDto } from './dto/bulk-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from './entities/user.entity';
import { ExportFormat, ExportService } from '../common/export/export.service';
import { MaskingInterceptor } from '../utils/masking/masking.interceptor';

/**
 * Exposes users endpoints.
 */
@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(MaskingInterceptor)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Creates a new record.
   * @param createUserDto The request payload.
   * @returns The operation result.
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  /**
   * Returns all.
   * @returns The operation result.
   */
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  /**
   * Returns one.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateUserDto The request payload.
   * @returns The operation result.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch('bulk-update')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update multiple users (Admin only)' })
  bulkUpdate(@Body() bulkDto: BulkUpdateUsersDto) {
    return this.usersService.bulkUpdate(bulkDto.ids, bulkDto.data);
  }

  @Delete('bulk-delete')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete multiple users (Admin only)' })
  bulkRemove(@Body() bulkDto: BulkDeleteUsersDto) {
    return this.usersService.bulkRemove(bulkDto.ids);
  }

  @Post('me/export')
  @Throttle({ default: THROTTLE.STRICT })
  @ApiOperation({ summary: 'Request user data export (JSON or PDF)' })
  requestDataExport(
    @CurrentUser() user: { userId: string },
    @Body() body?: { format?: ExportFormat },
  ) {
    return this.exportService.requestUserDataExport(user.userId, body?.format ?? 'json');
  }

  /**
   * Returns export History.
   * @param user The user.
   * @returns The operation result.
   */
  @Get('me/export/history')
  @ApiOperation({ summary: 'Get export request history for the current user' })
  getExportHistory(@CurrentUser() user: { userId: string }) {
    return this.exportService.getUserExportHistory(user.userId);
  }

  /**
   * Downloads export.
   * @param user The user.
   * @param exportId The export identifier.
   * @param res The res.
   * @returns The operation result.
   */
  @Get('me/export/:exportId')
  @ApiOperation({ summary: 'Download a completed user export file' })
  async downloadExport(
    @CurrentUser() user: { userId: string },
    @Param('exportId') exportId: string,
    @Res() res: Response,
  ) {
    const file = await this.exportService.getCompletedExportFile(user.userId, exportId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.content);
  }
}
