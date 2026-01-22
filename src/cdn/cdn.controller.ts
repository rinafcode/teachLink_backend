import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CdnService } from './cdn.service';
import { UploadContentDto } from './dto/upload-content.dto';
import { ContentMetadata } from './entities/content-metadata.entity';

@ApiTags('CDN')
@Controller('cdn')
export class CdnController {
  private readonly logger = new Logger(CdnController.name);

  constructor(private readonly cdnService: CdnService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload content to CDN' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Content upload with optimization options',
    type: UploadContentDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Content uploaded successfully',
    type: ContentMetadata,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async uploadContent(
    @UploadedFile() file: Express.Multer.File,
    @Body() options: UploadContentDto,
  ): Promise<ContentMetadata> {
    try {
      if (!file) {
        throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Uploading file: ${file.originalname} (${file.size} bytes)`);

      const result = await this.cdnService.uploadContent(file, options);

      this.logger.log(`Successfully uploaded content: ${result.contentId}`);
      return result;
    } catch (error) {
      this.logger.error('Upload failed:', error);
      throw new HttpException(
        `Upload failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('content/:contentId')
  @ApiOperation({ summary: 'Get optimized content URL' })
  @ApiParam({ name: 'contentId', description: 'Content identifier' })
  @ApiQuery({ name: 'optimize', required: false, type: Boolean })
  @ApiQuery({ name: 'width', required: false, type: Number })
  @ApiQuery({ name: 'height', required: false, type: Number })
  @ApiQuery({ name: 'quality', required: false, type: Number })
  @ApiQuery({ name: 'format', required: false, enum: ['webp', 'jpeg', 'png'] })
  @ApiQuery({ name: 'userLocation', required: false, type: String })
  @ApiQuery({ name: 'bandwidth', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Content URL retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async getContentUrl(
    @Param('contentId') contentId: string,
    @Query('optimize') optimize?: string,
    @Query('width') width?: string,
    @Query('height') height?: string,
    @Query('quality') quality?: string,
    @Query('format') format?: 'webp' | 'jpeg' | 'png',
    @Query('userLocation') userLocation?: string,
    @Query('bandwidth') bandwidth?: string,
  ): Promise<{ url: string; metadata?: any }> {
    try {
      const options = {
        optimize: optimize === 'true',
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        quality: quality ? parseInt(quality) : undefined,
        format,
        userLocation,
        bandwidth: bandwidth ? parseFloat(bandwidth) : undefined,
      };

      const url = await this.cdnService.deliverContent(contentId, options);

      return { url };
    } catch (error) {
      this.logger.error(`Failed to get content URL for ${contentId}:`, error);
      if (error.message.includes('not found')) {
        throw new HttpException('Content not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Failed to retrieve content',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('content/:contentId')
  @ApiOperation({ summary: 'Invalidate content cache' })
  @ApiParam({ name: 'contentId', description: 'Content identifier' })
  @ApiResponse({ status: 200, description: 'Content cache invalidated successfully' })
  @ApiResponse({ status: 404, description: 'Content not found' })
  async invalidateContent(@Param('contentId') contentId: string): Promise<{ success: boolean }> {
    try {
      await this.cdnService.invalidateContent(contentId);
      this.logger.log(`Invalidated cache for content: ${contentId}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to invalidate content ${contentId}:`, error);
      throw new HttpException(
        'Failed to invalidate content',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check CDN health status' })
  @ApiResponse({ status: 200, description: 'CDN health status' })
  async getHealth(): Promise<{
    status: string;
    providers: Record<string, boolean>;
    timestamp: string;
  }> {
    try {
      // In a real implementation, check actual provider connectivity
      const providers = {
        cloudflare: true, // Mock health check
        aws: true,
      };

      return {
        status: 'healthy',
        providers,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        'Health check failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get CDN analytics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'CDN analytics data' })
  async getAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    try {
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // In a real implementation, aggregate analytics from providers
      return {
        totalRequests: 0,
        totalBandwidth: 0,
        cacheHitRate: 0,
        topContent: [],
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
