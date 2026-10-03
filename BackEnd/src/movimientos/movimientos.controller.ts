import { Controller } from '@nestjs/common';
import { MovimientosService } from './movimientos.service.js';

@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}
}
