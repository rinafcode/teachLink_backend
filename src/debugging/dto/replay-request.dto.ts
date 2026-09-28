import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/** Body accepted by the replay endpoint; all fields are optional overrides. */
export class ReplayRequestDto {
  @ApiPropertyOptional({
    description: 'Base URL to replay against. Defaults to the running instance.',
    example: 'http://127.0.0.1:3000',
  })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({
    description: 'Header values merged onto (and overriding) the captured headers.',
    example: { authorization: 'Bearer <fresh-token>' },
  })
  @IsOptional()
  @IsObject()
  headerOverrides?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Replacement request body. When omitted the captured body is reused.',
  })
  @IsOptional()
  bodyOverride?: unknown;
}
