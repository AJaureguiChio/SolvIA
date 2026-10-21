import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ABooleano,
  FECHA,
  ID,
  IMPORTE,
  MENSAJE_FECHA,
  MENSAJE_IMPORTE,
  PaginacionDto,
} from '../common/validacion.js';

export const ESTADOS_PLAN = ['al_corriente', 'atrasado', 'cubierto'] as const;

export class ListarCuentasDto extends PaginacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Matches(ID)
  deudorId?: string;

  // Solo administrador; para el gestor se ignora (siempre ve las suyas).
  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @ABooleano()
  @IsBoolean()
  sinAsignar?: boolean;

  @IsOptional()
  @IsIn(ESTADOS_PLAN)
  estadoPlan?: (typeof ESTADOS_PLAN)[number];

  @IsOptional()
  @ABooleano()
  @IsBoolean()
  liquidada?: boolean;

  @IsOptional()
  @Matches(FECHA, { message: `fechaCorte ${MENSAJE_FECHA}` })
  fechaCorte?: string;

  // "prioridad" ordena por el puntaje de atencion P (mayor primero).
  @IsOptional()
  @IsIn(['id', 'prioridad', 'saldo'])
  orden?: 'id' | 'prioridad' | 'saldo';
}

export class CuotaDto {
  @IsInt()
  @Min(1)
  numero: number;

  @Matches(FECHA, { message: `fechaVencimiento ${MENSAJE_FECHA}` })
  fechaVencimiento: string;

  @Matches(IMPORTE, { message: `monto ${MENSAJE_IMPORTE}` })
  monto: string;
}

export class PlanDto {
  @Matches(FECHA, { message: `fechaAcuerdo ${MENSAJE_FECHA}` })
  fechaAcuerdo: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(360)
  @ValidateNested({ each: true })
  @Type(() => CuotaDto)
  cuotas: CuotaDto[];
}

export class CrearCuentaDto {
  @Matches(ID, { message: 'deudorId inválido' })
  deudorId: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  referenciaExterna?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  producto?: string;

  @Matches(IMPORTE, { message: `montoInicial ${MENSAJE_IMPORTE}` })
  montoInicial: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message: 'moneda debe ser un código ISO de 3 letras',
  })
  moneda?: string;

  @IsOptional()
  @Matches(FECHA, { message: `fechaOriginacion ${MENSAJE_FECHA}` })
  fechaOriginacion?: string;

  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @ValidateNested()
  @Type(() => PlanDto)
  plan: PlanDto;
}

export class AsignacionDto {
  // null deja la cuenta sin asignar.
  @ValidateIf((o: AsignacionDto) => o.responsableId !== null)
  @IsUUID()
  responsableId: string | null;
}

export class DetalleCuentaDto {
  @IsOptional()
  @Matches(FECHA, { message: `fechaCorte ${MENSAJE_FECHA}` })
  fechaCorte?: string;
}
