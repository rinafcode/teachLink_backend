import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateModelDto } from './create-model.dto';
import { ModelStatus } from '../enums';

export class UpdateModelDto extends PartialType(CreateModelDto) {
  @IsOptional()
  @IsEnum(ModelStatus)
  status?: ModelStatus;
}
