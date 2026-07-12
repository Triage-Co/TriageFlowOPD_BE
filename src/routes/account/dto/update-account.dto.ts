import { PartialType } from '@nestjs/swagger';
import { CreateAccountDto } from './req-account.dto';

export class UpdateAccountDto extends PartialType(CreateAccountDto) {}
