import { Controller } from '@nestjs/common';
import { PagosService } from './pagos.service.js';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}
}
