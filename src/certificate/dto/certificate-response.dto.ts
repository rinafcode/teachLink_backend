import type { CertificateStatus, CertificateType } from "../entities/certificate.entity"

export class CertificateResponseDto {
  id: string
  title: string
  description?: string
  type: CertificateType
  recipientId: string
  recipientName: string
  recipientEmail: string
  issuerId: string
  issuerName: string
  issuerOrganization: string
  status: CertificateStatus
  skills?: string[]
  metadata?: Record<string, any>
  issuedAt?: Date
  expiresAt?: Date
  blockchainTxHash?: string
  blockchainNetwork?: string
  digitalSignature?: string
  verificationUrl?: string
  certificateHash?: string
  createdAt: Date
  updatedAt: Date
  isValid: boolean
  isExpired: boolean
}
