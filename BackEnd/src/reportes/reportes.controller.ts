import { Controller } from '@nestjs/common';
import { ReportesService } from './reportes.service.js';

@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}
}
