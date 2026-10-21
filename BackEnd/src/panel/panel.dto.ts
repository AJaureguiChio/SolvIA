import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { FECHA, MENSAJE_FECHA } from '../common/validacion.js';

export class ResumenPanelDto {
  @IsOptional()
  @Matches(FECHA, { message: `fechaCorte ${MENSAJE_FECHA}` })
  fechaCorte?: string;

  // Periodo de las metricas de flujo (pagos); por defecto los ultimos 6 meses.
  @IsOptional()
  @Matches(FECHA, { message: `desde ${MENSAJE_FECHA}` })
  desde?: string;

  @IsOptional()
  @Matches(FECHA, { message: `hasta ${MENSAJE_FECHA}` })
  hasta?: string;
}

export class PrioridadesDto {
  @IsOptional()
  @Matches(FECHA, { message: `fechaCorte ${MENSAJE_FECHA}` })
  fechaCorte?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
