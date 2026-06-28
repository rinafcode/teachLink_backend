import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModerationService } from './moderation.service';
import { ModerateContentDto } from './dto/moderate-content.dto';
import { ModerationResultDto } from './dto/moderation-result.dto';

@ApiTags('moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('check')
  @ApiOperation({ summary: 'Check content for policy violations' })
  check(@Body() dto: ModerateContentDto): Promise<ModerationResultDto> {
    return this.moderationService.moderate(dto.content);
  }
}
