import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  FECHA,
  ID,
  IMPORTE,
  MENSAJE_FECHA,
  MENSAJE_IMPORTE,
} from '../common/validacion.js';

// Tipos que aumentan la deuda (impacto positivo) y que la reducen (negativo).
export const TIPOS_CARGO = [
  'interes',
  'recargo',
  'reembolso',
  'reversion_pago',
  'ajuste_cargo',
] as const;
export const TIPOS_ABONO = [
  'descuento',
  'condonacion',
  'ajuste_abono',
] as const;
export const TIPOS_CON_PAGO = ['reembolso', 'reversion_pago'];

export type TipoMovimiento =
  (typeof TIPOS_CARGO)[number] | (typeof TIPOS_ABONO)[number];

export class CrearMovimientoDto {
  @IsIn([...TIPOS_CARGO, ...TIPOS_ABONO])
  tipo: TipoMovimiento;

  // Siempre positivo; el backend aplica el signo segun el tipo.
  @Matches(IMPORTE, { message: `monto ${MENSAJE_IMPORTE}` })
  monto: string;

  @Matches(FECHA, { message: `fechaEfectiva ${MENSAJE_FECHA}` })
  fechaEfectiva: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;

  @IsOptional()
  @Matches(ID, { message: 'pagoOrigenId inválido' })
  pagoOrigenId?: string;
}
