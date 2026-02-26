import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Get,
  Param,
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }

    // Basic validation
    const allowed = ['image/', 'video/', 'application/pdf'];
    if (!allowed.some((p) => file.mimetype.startsWith(p) || file.mimetype === 'application/pdf')) {
      throw new HttpException('Unsupported file type', HttpStatus.BAD_REQUEST);
    }

    // enforce a conservative size limit (e.g., 500MB) to avoid abuse
    const maxBytes = 500 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new HttpException('File too large', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    const user = req.user;

    this.logger.log(`User ${user?.id} uploading file ${file.originalname}`);

    const result = await this.mediaService.createFromUpload(user?.id, user?.tenantId, file);

    return result;
  }

  @Get(':contentId')
  @UseGuards(JwtAuthGuard)
  async getMetadata(@Param('contentId') contentId: string, @Req() req: any) {
    const user = req.user;
    const meta = await this.mediaService.findByContentId(contentId);
    if (!meta) throw new HttpException('Not found', HttpStatus.NOT_FOUND);

    // Access control: owner or same tenant or admin
    if (meta.ownerId && meta.ownerId !== user?.id && user?.role !== 'admin' && meta.tenantId !== user?.tenantId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return meta;
  }
}
