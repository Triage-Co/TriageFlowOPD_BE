import { Body, Controller, Post } from '@nestjs/common';
import { InfermedicaService } from './infermedica.service';
import { TriageDto, ParseDto } from './dto/infermedica.dto';


@Controller('infermedica')
export class InfermedicaController {
  constructor(private readonly infermedicaService: InfermedicaService) { }

  @Post("/parse")
  parse(@Body() parseDto: ParseDto) {
    return this.infermedicaService.parse(parseDto);
  }

  @Post("/diagnoise")
  diagnoise(@Body() triageDto: TriageDto) {
    return this.infermedicaService.diagnoise(triageDto);
  }

  @Post("/triage")
  triage(@Body() triageDto: TriageDto) {
    return this.infermedicaService.triage(triageDto);
  }

  @Post("/recommend_specialist")
  recommendSpecialist(@Body() triageDto: TriageDto) {
    return this.infermedicaService.recommendSpecialist(triageDto);
  }

}
