import { HttpException, HttpStatus } from '@nestjs/common';

// Error de negocio con el formato del contrato:
// { "error": { "code", "message", "details" } }.
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super({ code, message, details }, status);
  }

  static noEncontrado(recurso = 'Recurso') {
    return new ApiError(
      HttpStatus.NOT_FOUND,
      'NOT_FOUND',
      `${recurso} no encontrado`,
    );
  }

  static entradaInvalida(
    message: string,
    details: Record<string, unknown> = {},
  ) {
    return new ApiError(
      HttpStatus.BAD_REQUEST,
      'INVALID_INPUT',
      message,
      details,
    );
  }
}
