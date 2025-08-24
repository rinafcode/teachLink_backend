import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type Certificate, CertificateStatus } from "../entities/certificate.entity"
import type { CreateCertificateDto } from "../dto/create-certificate.dto"
import type { UpdateCertificateDto } from "../dto/update-certificate.dto"
import type { CertificateResponseDto } from "../dto/certificate-response.dto"
import type { VerifyCertificateDto } from "../dto/verify-certificate.dto"
import type { BlockchainService, CertificateBlockchainData } from "./blockchain.service"

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name)

  constructor(
    private certificateRepository: Repository<Certificate>,
    private blockchainService: BlockchainService,
  ) {}

  async create(createCertificateDto: CreateCertificateDto): Promise<CertificateResponseDto> {
    try {
      this.logger.log(`Creating certificate: ${createCertificateDto.title}`)

      // Create certificate entity
      const certificate = this.certificateRepository.create({
        ...createCertificateDto,
        expiresAt: createCertificateDto.expiresAt ? new Date(createCertificateDto.expiresAt) : null,
      })

      // Generate certificate hash
      const certificateHash = this.blockchainService.generateCertificateHash({
        title: certificate.title,
        recipientId: certificate.recipientId,
        issuerId: certificate.issuerId,
        createdAt: new Date(),
      })

      certificate.certificateHash = certificateHash

      // Save to database first
      const savedCertificate = await this.certificateRepository.save(certificate)

      // Create blockchain record
      try {
        const blockchainData: CertificateBlockchainData = {
          certificateId: savedCertificate.id,
          recipientId: savedCertificate.recipientId,
          issuerId: savedCertificate.issuerId,
          certificateHash,
          timestamp: Date.now(),
          signature: this.blockchainService.generateDigitalSignature(savedCertificate),
        }

        const blockchainTx = await this.blockchainService.createCertificateOnBlockchain(blockchainData)

        // Update certificate with blockchain info
        savedCertificate.blockchainTxHash = blockchainTx.txHash
        savedCertificate.blockchainNetwork = blockchainTx.network
        savedCertificate.digitalSignature = blockchainData.signature
        savedCertificate.status = CertificateStatus.ISSUED
        savedCertificate.issuedAt = new Date()
        savedCertificate.verificationUrl = `${process.env.APP_URL}/certificates/verify/${savedCertificate.id}`

        await this.certificateRepository.save(savedCertificate)
      } catch (blockchainError) {
        this.logger.error(`Blockchain creation failed: ${blockchainError.message}`)
        // Certificate is still saved in database but without blockchain verification
      }

      return this.mapToResponseDto(savedCertificate)
    } catch (error) {
      this.logger.error(`Failed to create certificate: ${error.message}`)
      throw new BadRequestException(`Failed to create certificate: ${error.message}`)
    }
  }

  async findAll(
    recipientId?: string,
    issuerId?: string,
    status?: CertificateStatus,
  ): Promise<CertificateResponseDto[]> {
    const where: any = {}

    if (recipientId) where.recipientId = recipientId
    if (issuerId) where.issuerId = issuerId
    if (status) where.status = status

    const certificates = await this.certificateRepository.find({
      where,
      order: { createdAt: "DESC" },
    })

    return certificates.map((cert) => this.mapToResponseDto(cert))
  }

  async findOne(id: string): Promise<CertificateResponseDto> {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
    })

    if (!certificate) {
      throw new NotFoundException(`Certificate with ID ${id} not found`)
    }

    return this.mapToResponseDto(certificate)
  }

  async update(id: string, updateCertificateDto: UpdateCertificateDto): Promise<CertificateResponseDto> {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
    })

    if (!certificate) {
      throw new NotFoundException(`Certificate with ID ${id} not found`)
    }

    // Update certificate
    Object.assign(certificate, updateCertificateDto)

    if (updateCertificateDto.expiresAt) {
      certificate.expiresAt = new Date(updateCertificateDto.expiresAt)
    }

    const updatedCertificate = await this.certificateRepository.save(certificate)
    return this.mapToResponseDto(updatedCertificate)
  }

  async revoke(id: string, reason: string): Promise<CertificateResponseDto> {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
    })

    if (!certificate) {
      throw new NotFoundException(`Certificate with ID ${id} not found`)
    }

    if (certificate.status === CertificateStatus.REVOKED) {
      throw new BadRequestException("Certificate is already revoked")
    }

    // Revoke on blockchain if it exists
    if (certificate.blockchainTxHash) {
      try {
        await this.blockchainService.revokeCertificateOnBlockchain(certificate.blockchainTxHash, reason)
      } catch (error) {
        this.logger.error(`Failed to revoke on blockchain: ${error.message}`)
      }
    }

    // Update status
    certificate.status = CertificateStatus.REVOKED
    certificate.metadata = {
      ...certificate.metadata,
      revocationReason: reason,
      revokedAt: new Date(),
    }

    const revokedCertificate = await this.certificateRepository.save(certificate)
    return this.mapToResponseDto(revokedCertificate)
  }

  async verify(verifyDto: VerifyCertificateDto): Promise<{
    isValid: boolean
    certificate?: CertificateResponseDto
    blockchainVerification?: any
  }> {
    try {
      let certificate: Certificate | null = null

      // Find certificate by different methods
      if (verifyDto.certificateId) {
        certificate = await this.certificateRepository.findOne({
          where: { id: verifyDto.certificateId },
        })
      } else if (verifyDto.blockchainTxHash) {
        certificate = await this.certificateRepository.findOne({
          where: { blockchainTxHash: verifyDto.blockchainTxHash },
        })
      } else if (verifyDto.certificateHash) {
        certificate = await this.certificateRepository.findOne({
          where: { certificateHash: verifyDto.certificateHash },
        })
      }

      if (!certificate) {
        return { isValid: false }
      }

      // Check certificate status and expiration
      const isExpired = certificate.expiresAt && new Date() > certificate.expiresAt
      const isRevoked = certificate.status === CertificateStatus.REVOKED

      if (isRevoked || isExpired) {
        return {
          isValid: false,
          certificate: this.mapToResponseDto(certificate),
        }
      }

      // Verify on blockchain if available
      let blockchainVerification = null
      if (certificate.blockchainTxHash) {
        blockchainVerification = await this.blockchainService.verifyCertificateOnBlockchain(
          certificate.blockchainTxHash,
        )
      }

      const isValid =
        certificate.status === CertificateStatus.ISSUED &&
        !isExpired &&
        !isRevoked &&
        (!blockchainVerification || blockchainVerification.isValid)

      return {
        isValid,
        certificate: this.mapToResponseDto(certificate),
        blockchainVerification,
      }
    } catch (error) {
      this.logger.error(`Verification failed: ${error.message}`)
      return { isValid: false }
    }
  }

  async getSkillCertificates(recipientId: string, skill: string): Promise<CertificateResponseDto[]> {
    const certificates = await this.certificateRepository
      .createQueryBuilder("certificate")
      .where("certificate.recipientId = :recipientId", { recipientId })
      .andWhere("certificate.skills @> :skill", { skill: JSON.stringify([skill]) })
      .andWhere("certificate.status = :status", { status: CertificateStatus.ISSUED })
      .orderBy("certificate.issuedAt", "DESC")
      .getMany()

    return certificates.map((cert) => this.mapToResponseDto(cert))
  }

  async getCertificatesByOrganization(organization: string): Promise<CertificateResponseDto[]> {
    const certificates = await this.certificateRepository.find({
      where: { issuerOrganization: organization },
      order: { createdAt: "DESC" },
    })

    return certificates.map((cert) => this.mapToResponseDto(cert))
  }

  private mapToResponseDto(certificate: Certificate): CertificateResponseDto {
    const isExpired = certificate.expiresAt && new Date() > certificate.expiresAt
    const isValid = certificate.status === CertificateStatus.ISSUED && !isExpired

    return {
      ...certificate,
      isValid,
      isExpired: !!isExpired,
    }
  }
}
