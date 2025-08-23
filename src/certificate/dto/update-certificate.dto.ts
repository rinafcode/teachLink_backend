import { PartialType } from "@nestjs/mapped-types"
import { CreateCertificateDto } from "./create-certificate.dto"
import { IsEnum, IsOptional } from "class-validator"
import { CertificateStatus } from "../entities/certificate.entity"

export class UpdateCertificateDto extends PartialType(CreateCertificateDto) {
  @IsOptional()
  @IsEnum(CertificateStatus)
  status?: CertificateStatus
}
