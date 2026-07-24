import { PartialType } from '@nestjs/swagger';
import { CreatePoiDto } from './create-poi.dto';

export class UpdatePoiDto extends PartialType(CreatePoiDto) {}
