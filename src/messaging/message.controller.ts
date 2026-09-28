import { Controller, Post, Body, Get, Param, Patch, UseGuards, Query, Req } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CreateMessageDto } from './message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  async sendMessage(@Body() dto: CreateMessageDto) {
    const message = await this.messagingService.createMessage(dto);
    return { success: true, message };
  }

  @Get('conversation/:otherUserId')
  async getConversation(
    @Param('otherUserId') otherUserId: string,
    @Req() req: any,
    @Query() query?: PaginationQueryDto,
  ) {
    const conversation = await this.messagingService.getConversation(
      req.user.id,
      otherUserId,
      query,
    );
    return { success: true, conversation };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    await this.messagingService.markAsRead(id);
    return { success: true };
  }
}
