import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from './entities/user.entity';
import { ExportFormat, ExportService } from '../common/export/export.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all users (Admin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
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

  @Get('me/export/history')
  @ApiOperation({ summary: 'Get export request history for the current user' })
  getExportHistory(@CurrentUser() user: { userId: string }) {
    return this.exportService.getUserExportHistory(user.userId);
  }

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
