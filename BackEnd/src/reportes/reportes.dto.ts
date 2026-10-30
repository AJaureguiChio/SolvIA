import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ABooleano, FECHA, MENSAJE_FECHA } from '../common/validacion.js';

export class PrevisualizarReporteDto {
  @Matches(FECHA, { message: `desde ${MENSAJE_FECHA}` })
  desde: string;

  @Matches(FECHA, { message: `hasta ${MENSAJE_FECHA}` })
  hasta: string;

  // Indicaciones opcionales del administrador para el LLM (enfoque, tono).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  indicaciones?: string;

  // Alcance fijo: solo las cuentas de este gestor. Sin él, toda la cartera
  // o el gestor en el que se centre el LLM según las indicaciones.
  @IsOptional()
  @IsUUID()
  gestorId?: string;
}

// Llega como multipart/form-data junto con el PDF (campo `pdf`).
export class CrearReporteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @Matches(FECHA, { message: `periodoDesde ${MENSAJE_FECHA}` })
  periodoDesde: string;

  @Matches(FECHA, { message: `periodoHasta ${MENSAJE_FECHA}` })
  periodoHasta: string;

  // En multipart llega como JSON ('["uuid", ...]').
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  destinatarioIds: string[];

  // true: la entrega se confirma en el mismo alta.
  @IsOptional()
  @ABooleano()
  @IsBoolean()
  entregar?: boolean;
}

export class EntregarReporteDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  usuarioIds: string[];
}
