import { Exclude } from 'class-transformer';

export class GdprExportDto {
  @Exclude()
  password?: string;

  @Exclude()
  refreshToken?: string;

  @Exclude()
  passwordHistory?: string[];

  @Exclude()
  totpSecret?: string;

  @Exclude()
  token?: string;

  constructor(partial: Partial<GdprExportDto>) {
    Object.assign(this, partial);
  }
}
