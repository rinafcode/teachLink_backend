import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { CertificateService } from '../services/certificate.service';
import type { CreateCertificateDto } from '../dto/create-certificate.dto';
import type { UpdateCertificateDto } from '../dto/update-certificate.dto';
import type { VerifyCertificateDto } from '../dto/verify-certificate.dto';
import type { CertificateStatus } from '../entities/certificate.entity';

@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(createCertificateDto: CreateCertificateDto) {
    return this.certificateService.create(createCertificateDto);
  }

  @Get()
  async findAll(
    @Query('recipientId') recipientId?: string,
    @Query('issuerId') issuerId?: string,
    @Query('status') status?: CertificateStatus,
  ) {
    return this.certificateService.findAll(recipientId, issuerId, status);
  }

  @Get('skills/:recipientId/:skill')
  async getSkillCertificates(
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
    @Param('skill') skill: string,
  ) {
    return this.certificateService.getSkillCertificates(recipientId, skill);
  }

  @Get('organization/:organization')
  async getCertificatesByOrganization(
    @Param('organization') organization: string,
  ) {
    return this.certificateService.getCertificatesByOrganization(organization);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.certificateService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    updateCertificateDto: UpdateCertificateDto,
  ) {
    return this.certificateService.update(id, updateCertificateDto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.certificateService.revoke(id, reason);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(verifyDto: VerifyCertificateDto) {
    return this.certificateService.verify(verifyDto);
  }

  @Get('verify/:id')
  async verifyById(@Param('id', ParseUUIDPipe) id: string) {
    return this.certificateService.verify({ certificateId: id });
  }
}
