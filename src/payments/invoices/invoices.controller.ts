import { Controller, Get, Param, StreamableFile, Header, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':id')
  async getInvoice(@Param('id') id: string) {
    return this.invoicesService.getInvoice(id);
  }

  @Get(':id/download')
  @Header('Content-Type', 'text/html')
  @Header('Content-Disposition', 'attachment; filename="invoice.html"')
  async downloadInvoice(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const invoice = await this.invoicesService.getInvoice(id);
    
    if (!invoice.fileUrl) {
      throw new NotFoundException('Invoice file not generated yet');
    }

    const filePath = this.invoicesService.getInvoiceFilePath(invoice.fileUrl);
    const file = createReadStream(filePath);
    
    res.set({
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.html"`,
    });

    return new StreamableFile(file);
  }
}
