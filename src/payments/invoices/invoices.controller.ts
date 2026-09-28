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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User, UserRole } from '../../users/entities/user.entity';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
@ApiResponse({ status: 401, description: 'Authentication required' })
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by ID (owner or admin only)' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'The requested invoice' })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found (also returned when the caller does not own it)',
  })
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
  @ApiOperation({ summary: 'Download the rendered invoice as an HTML file (owner or admin only)' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiProduces('text/html')
  @ApiResponse({
    status: 200,
    description: 'The invoice HTML file as an attachment',
    content: { 'text/html': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({
    status: 404,
    description:
      'Invoice or invoice file not found (also returned when the caller does not own it)',
  })
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
