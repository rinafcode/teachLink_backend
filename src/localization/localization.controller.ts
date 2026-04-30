import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { RequestWithLocale } from '../common/types/request-with-locale';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { BundleQueryDto } from './dto/bundle-query.dto';
import { CreateTranslationDto } from './dto/create-translation.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { ImportTranslationsDto } from './dto/import-translations.dto';
import { ListTranslationsQueryDto } from './dto/list-translations-query.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { LanguageDetectionService } from './language-detection.service';
import { LocalizationService } from './localization.service';

/**
 * Exposes localization endpoints.
 */
@ApiTags('localization')
@Controller('localization')
export class LocalizationController {
  constructor(
    private readonly localizationService: LocalizationService,
    private readonly languageDetection: LanguageDetectionService,
  ) {}

  /**
   * Returns bundle.
   * @param query The query value.
   * @param req The req.
   * @returns The operation result.
   */
  @Get('bundle')
  @ApiOperation({ summary: 'Get merged translation bundle for a namespace' })
  async getBundle(@Query() query: BundleQueryDto, @Req() req: RequestWithLocale) {
    const locale =
      query.locale?.trim() || req.resolvedLocale || this.languageDetection.getDefaultLocale();
    return this.localizationService.getBundleForApi(query.namespace, locale);
  }

  /**
   * Executes detect.
   * @param req The req.
   * @param lang The lang.
   * @returns The operation result.
   */
  @Get('detect')
  @ApiOperation({ summary: 'Show how the request locale was resolved' })
  @ApiQuery({ name: 'lang', required: false })
  detect(@Req() req: RequestWithLocale, @Query('lang') lang?: string) {
    return this.languageDetection.resolveWithSource(req, lang);
  }

  /**
   * Returns admin.
   * @param query The query value.
   * @returns The operation result.
   */
  @Get('admin/translations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List translations (admin)' })
  listAdmin(@Query() query: ListTranslationsQueryDto) {
    return this.localizationService.findAll(query);
  }

  /**
   * Returns one.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('admin/translations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one translation (admin)' })
  findOne(@Param('id') id: string) {
    return this.localizationService.findOne(id);
  }

  /**
   * Creates a new record.
   * @param dto The dto.
   * @returns The operation result.
   */
  @Post('admin/translations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create translation (admin)' })
  create(@Body() dto: CreateTranslationDto) {
    return this.localizationService.create(dto);
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param dto The dto.
   * @returns The operation result.
   */
  @Patch('admin/translations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update translation (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateTranslationDto) {
    return this.localizationService.update(id, dto);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Delete('admin/translations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete translation (admin)' })
  async remove(@Param('id') id: string) {
    await this.localizationService.remove(id);
    return { deleted: true };
  }

  /**
   * Imports import.
   * @param body The body.
   * @returns The operation result.
   */
  @Post('admin/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert translations from JSON (admin)' })
  import(@Body() body: ImportTranslationsDto) {
    const rows = body.translations ?? body.rows;
    if (!rows?.length) {
      throw new BadRequestException('Provide translations or rows array with at least one item');
    }
    return this.localizationService.importRows(rows);
  }

  /**
   * Exports export.
   * @param query The query value.
   * @param res The res.
   * @returns The operation result.
   */
  @Get('admin/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export translations as JSON or CSV (admin)' })
  @ApiProduces('application/json', 'text/csv')
  async export(@Query() query: ExportQueryDto, @Res({ passthrough: true }) res: Response) {
    const rows = await this.localizationService.exportRows(query.namespace, query.locale);
    const format = query.format ?? 'json';
    if (format === 'csv') {
      const csv = LocalizationService.toCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="translations-${query.namespace}.csv"`,
      );
      return csv;
    }
    return rows;
  }
}
