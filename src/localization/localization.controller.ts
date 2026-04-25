import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards, } from '@nestjs/common';
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
@ApiTags('localization')
@Controller('localization')
export class LocalizationController {
    constructor(private readonly localizationService: LocalizationService, private readonly languageDetection: LanguageDetectionService) { }
    @Get('bundle')
    @ApiOperation({ summary: 'Get merged translation bundle for a namespace' })
    async getBundle(
    @Query()
    query: BundleQueryDto, 
    @Req()
    req: RequestWithLocale) {
        const locale = query.locale?.trim() || req.resolvedLocale || this.languageDetection.getDefaultLocale();
        return this.localizationService.getBundleForApi(query.namespace, locale);
    }
    @Get('detect')
    @ApiOperation({ summary: 'Show how the request locale was resolved' })
    @ApiQuery({ name: 'lang', required: false })
    detect(
    @Req()
    req: RequestWithLocale, 
    @Query('lang')
    lang?: string) {
        return this.languageDetection.resolveWithSource(req, lang);
    }
    @Get('admin/translations')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List translations (admin)' })
    listAdmin(
    @Query()
    query: ListTranslationsQueryDto) {
        return this.localizationService.findAll(query);
    }
    @Get('admin/translations/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get one translation (admin)' })
    findOne(
    @Param('id')
    id: string) {
        return this.localizationService.findOne(id);
    }
    @Post('admin/translations')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create translation (admin)' })
    create(
    @Body()
    dto: CreateTranslationDto) {
        return this.localizationService.create(dto);
    }
    @Patch('admin/translations/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update translation (admin)' })
    update(
    @Param('id')
    id: string, 
    @Body()
    dto: UpdateTranslationDto) {
        return this.localizationService.update(id, dto);
    }
    @Delete('admin/translations/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete translation (admin)' })
    async remove(
    @Param('id')
    id: string) {
        await this.localizationService.remove(id);
        return { deleted: true };
    }
    @Post('admin/import')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Upsert translations from JSON (admin)' })
    import(
    @Body()
    body: ImportTranslationsDto) {
        const rows = body.translations ?? body.rows;
        if (!rows?.length) {
            throw new BadRequestException('Provide translations or rows array with at least one item');
        }
        return this.localizationService.importRows(rows);
    }
    @Get('admin/export')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Export translations as JSON or CSV (admin)' })
    @ApiProduces('application/json', 'text/csv')
    async export(
    @Query()
    query: ExportQueryDto, 
    @Res({ passthrough: true })
    res: Response) {
        const rows = await this.localizationService.exportRows(query.namespace, query.locale);
        const format = query.format ?? 'json';
        if (format === 'csv') {
            const csv = LocalizationService.toCsv(rows);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="translations-${query.namespace}.csv"`);
            return csv;
        }
        return rows;
    }
}
