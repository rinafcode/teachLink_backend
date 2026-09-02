import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CdnService } from './cdn.service';
import { UploadContentDto } from './dto/upload-content.dto';
import { TenantLimitGuard, LimitType } from '../tenancy/guards/tenant-limit.guard';

@Controller('cdn')
export class CdnController {
  constructor(private readonly cdnService: CdnService) {}

  @Post('upload')
  @LimitType('storage')
  @UseGuards(TenantLimitGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max limit to prevent excessive memory usage. Exact validation is in CdnService.
      },
    }),
  )
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Body() _uploadContentDto: UploadContentDto,
  ) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }

    // Validate size and magic bytes
    await this.cdnService.validateUpload(file.buffer, file.mimetype);

    // Placeholder for actual upload logic
    return {
      success: true,
      message: 'File validated and uploaded successfully',
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }
}
