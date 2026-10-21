import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginacionDto } from '../common/validacion.js';

const mayusculas = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

export class ListarDeudoresDto extends PaginacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class CrearDeudorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nombre: string;

  @IsOptional()
  @mayusculas()
  @Matches(/^[A-Z0-9]{18}$/, { message: 'curp debe tener 18 caracteres' })
  curp?: string | null;

  @IsOptional()
  @mayusculas()
  @Matches(/^[A-Z&Ñ0-9]{12,13}$/, {
    message: 'rfc debe tener 12 o 13 caracteres',
  })
  rfc?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ciudad?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  segmento?: string | null;

  @IsInt()
  @Min(0)
  @Max(1000)
  scoreBuro: number;
}

export class ActualizarDeudorDto extends PartialType(CrearDeudorDto) {}
