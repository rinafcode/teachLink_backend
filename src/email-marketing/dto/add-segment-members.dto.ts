import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddSegmentMembersDto {
    @ApiProperty({
        description: 'Array of user IDs to add to the segment',
        example: ['user1', 'user2', 'user3'],
        type: [String]
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    userIds: string[];
}
