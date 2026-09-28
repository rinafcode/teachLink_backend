import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { TaxService } from './tax.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Payment])],
  controllers: [InvoicesController],
  providers: [InvoicesService, TaxService],
  exports: [InvoicesService, TaxService],
})
export class InvoicesModule {}
