import {
  Injectable,
  NotFoundException,
} from "@nestjs/common";

@Injectable()
export class EmailTemplateService {

  constructor(
    @InjectRepository(
      EmailTemplate,
    )
    private readonly repository:
      Repository<EmailTemplate>,
  ) {}

  async create(
    dto: CreateEmailTemplateDto,
  ) {
    return this.repository.save(
      dto,
    );
  }

  async update(
    id: string,
    dto: UpdateEmailTemplateDto,
  ) {
    await this.repository.update(
      id,
      dto,
    );

    return this.findById(id);
  }

  async findById(
    id: string,
  ) {
    const template =
      await this.repository.findOne({
        where: { id },
      });

    if (!template) {
      throw new NotFoundException(
        "Template not found",
      );
    }

    return template;
  }

  async preview(
    id: string,
    variables: Record<
      string,
      string
    >,
  ) {
    const template =
      await this.findById(
        id,
      );

    let subject =
      template.subject;

    let body =
      template.body;

    Object.entries(
      variables,
    ).forEach(
      ([key, value]) => {
        const token =
          `{{${key}}}`;

        subject =
          subject.replaceAll(
            token,
            value,
          );

        body =
          body.replaceAll(
            token,
            value,
          );
      },
    );

    return {
      subject,
      body,
    };
  }
}