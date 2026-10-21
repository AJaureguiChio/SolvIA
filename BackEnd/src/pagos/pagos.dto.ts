import { Matches } from 'class-validator';
import {
  FECHA,
  IMPORTE,
  MENSAJE_FECHA,
  MENSAJE_IMPORTE,
} from '../common/validacion.js';

export class CrearPagoDto {
  @Matches(FECHA, { message: `fechaPago ${MENSAJE_FECHA}` })
  fechaPago: string;

  @Matches(IMPORTE, { message: `monto ${MENSAJE_IMPORTE}` })
  monto: string;
}
