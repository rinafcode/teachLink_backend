import {
  Controller,
  Get,
  Param,
  StreamableFile,
  Header,
  Res,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../users/entities/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':id')
  async getInvoice(@Param('id') id: string, @CurrentUser() currentUser: User) {
    // Fetch invoice first; return 404 for both missing and non-owned to
    // prevent id enumeration (no distinguishable difference to the caller).
    const invoice = await this.invoicesService.getInvoice(id);

    const isAdmin =
      Array.isArray(currentUser.roles) &&
      currentUser.roles.some((r) => (typeof r === 'string' ? r : r.name) === UserRole.ADMIN);

    if (!isAdmin && invoice.userId !== currentUser.id) {
      // Uniform 404 — identical to the "not found" path so callers cannot
      // distinguish between a missing invoice and one they do not own.
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  @Get(':id/download')
  @Header('Content-Type', 'text/html')
  @Header('Content-Disposition', 'attachment; filename="invoice.html"')
  async downloadInvoice(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const invoice = await this.invoicesService.getInvoice(id);

    const isAdmin =
      Array.isArray(currentUser.roles) &&
      currentUser.roles.some((r) => (typeof r === 'string' ? r : r.name) === UserRole.ADMIN);

    if (!isAdmin && invoice.userId !== currentUser.id) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (!invoice.fileUrl) {
      throw new NotFoundException('Invoice file not generated yet');
    }

    // getInvoiceFilePath validates the resolved path is within the archive
    // root; it throws if the path escapes the archive directory.
    const filePath = this.invoicesService.getInvoiceFilePath(invoice.fileUrl);
    const file = createReadStream(filePath);

    res.set({
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.html"`,
      'X-Content-Type-Options': 'nosniff',
    });

    return new StreamableFile(file);
  }
}
