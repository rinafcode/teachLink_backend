import { IsUUID, IsString, IsNotEmpty } from 'class-validator';

export class CreateMessageDto {
  @IsUUID()
  senderId: string;

  @IsUUID()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class MarkReadDto {
  @IsUUID()
  messageId: string;
}
