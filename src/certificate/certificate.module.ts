import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Certificate } from './entities/certificate.entity';
import { CertificateService } from './services/certificate.service';
import { BlockchainService } from './services/blockchain.service';
import { CertificateController } from './controllers/certificate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate]), ConfigModule],
  controllers: [CertificateController],
  providers: [CertificateService, BlockchainService],
  exports: [CertificateService, BlockchainService],
})
export class CertificateModule {}
