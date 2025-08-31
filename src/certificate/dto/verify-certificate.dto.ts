import { IsString, IsOptional, IsUUID } from "class-validator"

export class VerifyCertificateDto {
  @IsOptional()
  @IsUUID()
  certificateId?: string

  @IsOptional()
  @IsString()
  blockchainTxHash?: string

  @IsOptional()
  @IsString()
  certificateHash?: string
}
