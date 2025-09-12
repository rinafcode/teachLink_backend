import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';

import { CertificateService } from './services/certificate.service';
import { BlockchainService } from './services/blockchain.service';
import {
  Certificate,
  CertificateStatus,
  CertificateType,
} from './entities/certificate.entity';
import type { CreateCertificateDto } from './dto/create-certificate.dto';

describe('CertificateService', () => {
  let service: CertificateService;
  let repository: Repository<Certificate>;
  let blockchainService: BlockchainService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBlockchainService = {
    generateCertificateHash: jest.fn(),
    generateDigitalSignature: jest.fn(),
    createCertificateOnBlockchain: jest.fn(),
    verifyCertificateOnBlockchain: jest.fn(),
    revokeCertificateOnBlockchain: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificateService,
        {
          provide: getRepositoryToken(Certificate),
          useValue: mockRepository,
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CertificateService>(CertificateService);
    repository = module.get<Repository<Certificate>>(
      getRepositoryToken(Certificate),
    );
    blockchainService = module.get<BlockchainService>(BlockchainService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createCertificateDto: CreateCertificateDto = {
      title: 'JavaScript Certification',
      description: 'Advanced JavaScript skills certification',
      type: CertificateType.SKILL,
      recipientId: '123e4567-e89b-12d3-a456-426614174000',
      recipientName: 'John Doe',
      recipientEmail: 'john@example.com',
      issuerId: '123e4567-e89b-12d3-a456-426614174001',
      issuerName: 'Jane Smith',
      issuerOrganization: 'Tech Academy',
      skills: ['JavaScript', 'ES6', 'Node.js'],
      metadata: { level: 'advanced' },
    };

    it('should create a certificate successfully', async () => {
      const mockCertificate = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        ...createCertificateDto,
        status: CertificateStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBlockchainTx = {
        txHash: '0x123abc',
        blockNumber: 1000000,
        network: 'ethereum-testnet',
        timestamp: new Date(),
        status: 'success' as const,
      };

      mockRepository.create.mockReturnValue(mockCertificate);
      mockRepository.save.mockResolvedValueOnce(mockCertificate);
      mockBlockchainService.generateCertificateHash.mockReturnValue('hash123');
      mockBlockchainService.generateDigitalSignature.mockReturnValue(
        'signature123',
      );
      mockBlockchainService.createCertificateOnBlockchain.mockResolvedValue(
        mockBlockchainTx,
      );

      const updatedCertificate = {
        ...mockCertificate,
        blockchainTxHash: mockBlockchainTx.txHash,
        blockchainNetwork: mockBlockchainTx.network,
        digitalSignature: 'signature123',
        status: CertificateStatus.ISSUED,
        issuedAt: new Date(),
        certificateHash: 'hash123',
      };

      mockRepository.save.mockResolvedValueOnce(updatedCertificate);

      const result = await service.create(createCertificateDto);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createCertificateDto,
        expiresAt: null,
      });
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
      expect(
        mockBlockchainService.createCertificateOnBlockchain,
      ).toHaveBeenCalled();
      expect(result.id).toBe(mockCertificate.id);
      expect(result.status).toBe(CertificateStatus.ISSUED);
      expect(result.isValid).toBe(true);
    });

    it('should handle blockchain creation failure gracefully', async () => {
      const mockCertificate = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        ...createCertificateDto,
        status: CertificateStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockCertificate);
      mockRepository.save.mockResolvedValue(mockCertificate);
      mockBlockchainService.generateCertificateHash.mockReturnValue('hash123');
      mockBlockchainService.createCertificateOnBlockchain.mockRejectedValue(
        new Error('Blockchain network error'),
      );

      const result = await service.create(createCertificateDto);

      expect(result.id).toBe(mockCertificate.id);
      expect(result.blockchainTxHash).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('should return a certificate when found', async () => {
      const mockCertificate = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'JavaScript Certification',
        status: CertificateStatus.ISSUED,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockCertificate);

      const result = await service.findOne(
        '123e4567-e89b-12d3-a456-426614174002',
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123e4567-e89b-12d3-a456-426614174002' },
      });
      expect(result.id).toBe(mockCertificate.id);
      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
    });

    it('should throw NotFoundException when certificate not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('123e4567-e89b-12d3-a456-426614174002'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verify', () => {
    it('should verify a valid certificate', async () => {
      const mockCertificate = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'JavaScript Certification',
        status: CertificateStatus.ISSUED,
        expiresAt: null,
        blockchainTxHash: '0x123abc',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBlockchainVerification = {
        isValid: true,
        certificateData: {},
        transaction: {},
      };

      mockRepository.findOne.mockResolvedValue(mockCertificate);
      mockBlockchainService.verifyCertificateOnBlockchain.mockResolvedValue(
        mockBlockchainVerification,
      );

      const result = await service.verify({
        certificateId: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(result.isValid).toBe(true);
      expect(result.certificate).toBeDefined();
      expect(result.blockchainVerification).toBeDefined();
    });

    it('should return invalid for revoked certificate', async () => {
      const mockCertificate = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'JavaScript Certification',
        status: CertificateStatus.REVOKED,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockCertificate);

      const result = await service.verify({
        certificateId: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(result.isValid).toBe(false);
      expect(result.certificate).toBeDefined();
    });

    it('should return invalid for expired certificate', async () => {
      const mockCertificate = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'JavaScript Certification',
        status: CertificateStatus.ISSUED,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockCertificate);

      const result = await service.verify({
        certificateId: '123e4567-e89b-12d3-a456-426614174002',
      });

      expect(result.isValid).toBe(false);
      expect(result.certificate.isExpired).toBe(true);
    });
  });

  describe('revoke', () => {
    it('should revoke a certificate successfully', async () => {
      const mockCertificate = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        title: 'JavaScript Certification',
        status: CertificateStatus.ISSUED,
        blockchainTxHash: '0x123abc',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBlockchainTx = {
        txHash: '0x456def',
        blockNumber: 1000001,
        network: 'ethereum-testnet',
        timestamp: new Date(),
        status: 'success' as const,
      };

      mockRepository.findOne.mockResolvedValue(mockCertificate);
      mockBlockchainService.revokeCertificateOnBlockchain.mockResolvedValue(
        mockBlockchainTx,
      );

      const revokedCertificate = {
        ...mockCertificate,
        status: CertificateStatus.REVOKED,
        metadata: {
          revocationReason: 'Test revocation',
          revokedAt: expect.any(Date),
        },
      };

      mockRepository.save.mockResolvedValue(revokedCertificate);

      const result = await service.revoke(
        '123e4567-e89b-12d3-a456-426614174002',
        'Test revocation',
      );

      expect(
        mockBlockchainService.revokeCertificateOnBlockchain,
      ).toHaveBeenCalledWith('0x123abc', 'Test revocation');
      expect(result.status).toBe(CertificateStatus.REVOKED);
      expect(result.isValid).toBe(false);
    });

    it('should throw BadRequestException for already revoked certificate', async () => {
      const mockCertificate = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        status: CertificateStatus.REVOKED,
      };

      mockRepository.findOne.mockResolvedValue(mockCertificate);

      await expect(
        service.revoke(
          '123e4567-e89b-12d3-a456-426614174002',
          'Test revocation',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSkillCertificates', () => {
    it('should return certificates for a specific skill', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            title: 'JavaScript Certification',
            skills: ['JavaScript', 'Node.js'],
            status: CertificateStatus.ISSUED,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getSkillCertificates(
        '123e4567-e89b-12d3-a456-426614174000',
        'JavaScript',
      );

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith(
        'certificate',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0].skills).toContain('JavaScript');
    });
  });
});
