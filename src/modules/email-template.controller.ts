import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

@Controller('email-templates')
export class EmailTemplateController {
  constructor(private readonly service: EmailTemplateService) {}

  @Post()
  create(
    @Body()
    dto: CreateEmailTemplateDto,
  ) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateEmailTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.service.findById(id);
  }

  @Post(':id/preview')
  preview(
    @Param('id')
    id: string,

    @Body()
    dto: PreviewTemplateDto,
  ) {
    return this.service.preview(id, dto.variables);
  }
}
