import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { UploadMediaDto, MediaResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { MediaType } from './entities/media.entity';

@ApiTags('Media')
@Controller('media')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a media file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: MediaResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid file or data' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadMediaDto,
    @Req() req,
  ): Promise<MediaResponseDto> {
    return this.mediaService.uploadFile(file, uploadDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all media files for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Media files retrieved successfully',
    type: [MediaResponseDto],
  })
  async findAll(
    @Req() req,
    @Query('type') type?: MediaType,
  ): Promise<MediaResponseDto[]> {
    return this.mediaService.findAll(req.user, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific media file' })
  @ApiResponse({
    status: 200,
    description: 'Media file retrieved successfully',
    type: MediaResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Media file not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(
    @Param('id') id: string,
    @Req() req,
  ): Promise<MediaResponseDto> {
    return this.mediaService.findById(id, req.user);
  }

  @Get(':id/stream')
  @ApiOperation({ summary: 'Get streaming URL for video' })
  @ApiResponse({
    status: 200,
    description: 'Streaming URL generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or file not ready',
  })
  async getStreamingUrl(
    @Param('id') id: string,
    @Req() req,
    @Query('quality') quality?: string,
  ): Promise<{ streamingUrl: string }> {
    const streamingUrl = await this.mediaService.getStreamingUrl(
      id,
      req.user,
      quality,
    );
    return { streamingUrl };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a media file' })
  @ApiResponse({ status: 200, description: 'Media file deleted successfully' })
  @ApiResponse({ status: 404, description: 'Media file not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async remove(
    @Param('id') id: string,
    @Req() req,
  ): Promise<{ message: string }> {
    await this.mediaService.deleteMedia(id, req.user);
    return { message: 'Media file deleted successfully' };
  }
}
