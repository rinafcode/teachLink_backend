import { IsUUID, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ description: 'ID of the message sender' })
  @IsUUID()
  senderId: string;

  @ApiProperty({ description: 'ID of the message recipient' })
  @IsUUID()
  recipientId: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, I have a question about your course.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class MarkReadDto {
  @ApiProperty({ description: 'ID of the message to mark as read' })
  @IsUUID()
  messageId: string;
}
