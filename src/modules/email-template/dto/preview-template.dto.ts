import {
  IsObject,
} from "class-validator";

export class PreviewTemplateDto {
  @IsObject()
  variables: Record<
    string,
    string
  >;
}