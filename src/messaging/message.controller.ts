import { Controller, Post, Body, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { CreateMessageDto } from './message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
    @Param('userId') userId: string,
  ) {
    // Assuming userId is retrieved from auth token via a custom decorator; placeholder for now
    const conversation = await this.messagingService.getConversation(userId, otherUserId);
    return { success: true, conversation };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string) {
    await this.messagingService.markAsRead(id);
    return { success: true };
  }
}
