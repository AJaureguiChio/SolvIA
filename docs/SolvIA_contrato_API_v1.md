# SolvIA — propuesta de endpoints de la API v1

**Estado:** diseño para revisión, basado en `SolvIA_esquema_final.sql`, el mapa funcional, las quince pantallas del wireframe y la propuesta posterior de verificación facial obligatoria. Base común: `/api/v1`. La API la implementará NestJS; la identidad y las sesiones pertenecen a Neon Auth.

## 1. Convenciones y acceso

- **Roles:** `administrador` y `gestor`. El backend identifica al usuario mediante una sesión de Neon Auth comprobada por el servidor, busca su `perfiles_usuario`, exige `activo = true` y comprueba el rol. Nunca acepta `registradoPor`, `generadoPor` ni `asignacionModificadaPor` enviados por el cliente: usa el ID autenticado.
- **Verificación facial:** en el alcance actualizado es obligatoria después de identificar al usuario con Neon Auth. Salvo los pasos de inscripción y verificación, las rutas de negocio exigen también una prueba vigente de verificación facial emitida y validada por el backend. La prueba debe estar vinculada al ID de Neon Auth y caducar. La sesión de Neon Auth por sí sola no abre las rutas de negocio.
- **Primer acceso:** el primer administrador se provisiona mediante un procedimiento controlado de configuración, fuera de una ruta pública. Para los demás usuarios, el alta y la inscripción facial requieren un proceso seguro que no deje abierta una ruta para autoproclamarse administrador. Las rutas de inscripción son las excepciones deliberadas a la exigencia facial porque, de lo contrario, un usuario nuevo nunca podría completar el primer acceso.
- **Ámbito de lectura:** el administrador ve la cartera completa; el gestor solo ve sus cuentas **actualmente** asignadas y, a través de ellas, sus deudores, pagos y movimientos. Un ID ajeno se responde como `404` para no confirmar la existencia del recurso. Los reportes del gestor requieren que figure como destinatario con entrega confirmada.
- **Formato:** JSON en camelCase; fechas de negocio `YYYY-MM-DD`; instantes UTC ISO 8601. Los importes `numeric(16,2)` se reciben y envían como cadenas decimales, por ejemplo `"1250.50"`. Los IDs `bigint` de PostgreSQL se serializan como cadenas, y los IDs de usuario como UUID. Colecciones paginadas con `page` y `pageSize` (máximo definido por el servidor), `items` y `total`.
- **Errores:** `{ "error": { "code": "SALDO_INSUFICIENTE", "message": "...", "details": {} } }`. `400` para formato, `401` para sesión o prueba facial ausente, `403` para rol o usuario inactivo, `404` para recurso fuera de ámbito, `409` para conflicto de estado o unicidad y `422` para reglas de negocio. En un fallo de verificación facial se devuelve un error específico sin revelar detalles de la comparación biométrica.

Neon Auth gestiona sus propias rutas de inicio de sesión, cierre de sesión y recuperación de credenciales. SolvIA **no** define otros `POST /login` ni una tabla de contraseñas. La conexión de PostgreSQL del backend queda solo del lado servidor. El esquema instalado no contiene políticas RLS para restringir lecturas, así que los filtros de autorización son responsabilidad imprescindible de NestJS.

## 2. Identidad, perfiles y verificación facial

| Método | Ruta | Acceso | Resultado y regla |
| --- | --- | --- | --- |
| `GET` | `/me` | Sesión Neon válida | Devuelve `id`, `rol`, `activo` y el estado de inscripción/verificación facial; antes de verificar el rostro solo expone datos mínimos para continuar el acceso. |
| `POST` | `/facial/inscripciones` | Usuario autenticado en el flujo de alta o reinicio autorizado | Recibe una captura por `multipart/form-data`; el backend coordina el microservicio Python y registra una plantilla protegida. **Requiere migración facial previa**. |
| `POST` | `/facial/verificaciones` | Sesión Neon válida y perfil activo | Recibe una captura; si coincide, emite una prueba temporal vinculada al usuario que permite usar la API de negocio. **Requiere integración facial**. |
| `GET` | `/usuarios` | Administrador verificado | Lista perfiles; filtros `rol` y `activo`. Incluye la información mínima necesaria para elegir gestores activos. |
| `POST` | `/usuarios` | Administrador verificado | Alta/invitación de identidad mediante el mecanismo elegido de Neon Auth y creación de perfil con rol y estado. El usuario todavía debe completar la inscripción facial. El flujo exacto de invitaciones queda pendiente. |
| `GET` | `/usuarios/{usuarioId}` | Administrador verificado | Perfil y cuentas asignadas; útil para decidir si se puede desactivar. |
| `PATCH` | `/usuarios/{usuarioId}` | Administrador verificado | Modifica solo `rol` y/o `activo`. Si es gestor con cuentas asignadas, rechaza desactivación o cambio de rol hasta reasignarlas. |
| `POST` | `/usuarios/{usuarioId}/restablecimiento-facial` | Administrador verificado | Inicia recuperación o sustitución de plantilla con validación adicional; diseño y migración pendientes. |

No se expone `DELETE /usuarios`: la baja funcional es `activo = false`. No se expone una ruta para que un usuario cambie por sí mismo su rol o salte la verificación facial.

## 3. Deudores

| Método | Ruta | Acceso | Resultado y regla |
| --- | --- | --- | --- |
| `GET` | `/deudores` | Ambos | Busca por `q` (nombre, CURP o RFC), filtra y pagina. El gestor solo obtiene deudores con alguna cuenta actualmente asignada a él. |
| `POST` | `/deudores` | Administrador | Registra nombre, al menos CURP o RFC ficticio, `scoreBuro` manual (0–1000), teléfono, ciudad y segmento opcionales. |
| `GET` | `/deudores/{deudorId}` | Ambos según ámbito | Muestra datos y cuentas relacionadas visibles para el solicitante. |
| `PATCH` | `/deudores/{deudorId}` | Administrador | Corrige únicamente datos que la tabla permite cambiar, incluido el score manual; valida unicidad y formato. |

No se exponen borrados de deudores en v1: podrían tener cuentas históricas y el esquema usa restricciones de referencias.

## 4. Cuentas, plan y asignaciones

| Método | Ruta | Acceso | Resultado y regla |
| --- | --- | --- | --- |
| `GET` | `/cuentas` | Ambos | Lista paginada con filtros `deudorId`, `responsableId` (administrador), `estadoPlan`, `liquidada` y `q`. El gestor se filtra obligatoriamente por su propio ID. Incluye `saldo` y estado calculados, no editables. |
| `POST` | `/cuentas` | Administrador | **Una transacción:** inserta cuenta, plan de pago y todas las cuotas; asignación inicial opcional a un gestor activo. La suma de las cuotas debe igualar `montoInicial`. |
| `GET` | `/cuentas/{cuentaId}` | Ambos según ámbito | Resumen de cuenta, deudor, responsable, saldo calculado, `estadoPlan`, `cuentaLiquidada` y plan con sus cuotas. |
| `PATCH` | `/cuentas/{cuentaId}/asignacion` | Administrador | Cambia `responsableId` por un gestor activo o `null` para dejar sin asignar. El backend identifica al administrador y el trigger inserta el historial. |
| `GET` | `/cuentas/{cuentaId}/asignaciones` | Ambos según ámbito | Historial de responsables registrado automáticamente; solo lectura. |

Ejemplo de alta:

```json
{
  "deudorId": "21",
  "referenciaExterna": "SOL-001",
  "producto": "Crédito personal",
  "montoInicial": "3000.00",
  "moneda": "MXN",
  "fechaOriginacion": "2026-10-01",
  "responsableId": "7029d31a-8465-4577-a9a4-94757118cf47",
  "plan": {
    "fechaAcuerdo": "2026-10-02",
    "cuotas": [
      { "numero": 1, "fechaVencimiento": "2026-11-02", "monto": "1500.00" },
      { "numero": 2, "fechaVencimiento": "2026-12-02", "monto": "1500.00" }
    ]
  }
}
```

Una cuota entra en mora al día **siguiente** de su vencimiento. El detalle debe mostrar por separado `estadoPlan` (`al_corriente`, `atrasado` o `cubierto`) y `cuentaLiquidada`, porque un plan cubierto todavía puede conservar cargos. No se exponen rutas para editar el plan, las cuotas, el monto inicial ni un `PATCH /cuentas/{id}/saldo`.

## 5. Pagos y movimientos de saldo

| Método | Ruta | Acceso | Resultado y regla |
| --- | --- | --- | --- |
| `GET` | `/cuentas/{cuentaId}/pagos` | Ambos según ámbito | Pagos de esa cuenta, paginados y ordenados por fecha. |
| `POST` | `/cuentas/{cuentaId}/pagos` | Gestor actualmente asignado | Recibe `{ "fechaPago": "2026-10-02", "monto": "250.00" }`; `registradoPor` sale de la sesión. El pago no puede superar el saldo ni fecharse antes del acuerdo o después de hoy. |
| `GET` | `/cuentas/{cuentaId}/movimientos` | Ambos según ámbito | Movimientos y motivos, paginados; muestra `impactoSaldo` con su signo. |
| `POST` | `/cuentas/{cuentaId}/movimientos` | Administrador | Recibe `tipo`, `monto` positivo, `fechaEfectiva`, `motivo` y `pagoOrigenId` cuando corresponda. El backend transforma `monto` al signo de `impacto_saldo` requerido por la base. |

Tipos que **aumentan** la deuda: `interes`, `recargo`, `reembolso`, `reversion_pago`, `ajuste_cargo`. Tipos que **reducen** la deuda: `descuento`, `condonacion`, `ajuste_abono`. `reembolso` y `reversion_pago` exigen `pagoOrigenId` de la misma cuenta; sus importes acumulados no pueden superar ese pago. Los pagos y movimientos son inmutables: los errores se corrigen mediante un movimiento nuevo con motivo, nunca con `PATCH` o `DELETE`. Las restricciones y los bloqueos de la base son la última validación ante operaciones concurrentes.

## 6. Paneles e indicadores

| Método | Ruta | Acceso | Resultado y regla |
| --- | --- | --- | --- |
| `GET` | `/panel/resumen?desde=...&hasta=...` | Ambos | Totales de cuentas, estados de planes, importes y serie de pagos para gráficas. El gestor recibe solo indicadores de sus cuentas; el administrador recibe toda la cartera. El periodo aplica a métricas de flujo, como pagos; el estado de cuenta se calcula para una fecha de corte explícita o el día actual. |
| `GET` | `/panel/prioridades?fechaCorte=...` | Ambos | Lista limitada de cuentas que requieren atención, con monto vencido, días de retraso y puntaje explicable. Calculado desde cuotas y pagos, sin columna persistida. |

La propuesta académica 3.1 define inicialmente `P = 60 × min(monto vencido sin cubrir / monto exigible, 1) + 40 × min(días de mora / 30, 1)`; si no hay monto exigible, `P = 0`. El puntaje es una **heurística de ordenamiento**, no una probabilidad de impago ni el score manual de buró.

## 7. Reportes PDF

| Método | Ruta | Acceso | Resultado y regla |
| --- | --- | --- | --- |
| `POST` | `/reportes/previsualizaciones` | Administrador | Recibe periodo y opciones; calcula métricas en el servidor y produce borrador explicativo y vista previa para revisión. No escribe en `reportes`. El mecanismo para conservar temporalmente el borrador hasta confirmación está pendiente. |
| `POST` | `/reportes` | Administrador | Confirma una previsualización revisada y los `destinatarioIds`; genera el PDF en el servidor y guarda **un** `archivo_pdf` más las filas de destinatarios en una transacción. Valida que las cifras sigan correspondiendo a los datos confirmados. |
| `GET` | `/reportes` | Ambos | Lista paginada por autor, periodo y fecha para administrador; para gestor, únicamente los reportes con entrega confirmada a su ID. |
| `GET` | `/reportes/{reporteId}` | Ambos según ámbito | Metadatos; el administrador ve todos los destinatarios y estados de entrega. |
| `GET` | `/reportes/{reporteId}/pdf` | Ambos según ámbito | Devuelve el binario desde PostgreSQL con `Content-Type: application/pdf` y disposición de descarga. |
| `POST` | `/reportes/{reporteId}/entregas` | Administrador | Recibe IDs de gestores ya registrados como destinatarios y confirma una sola vez `entregado_en`. En v1 «entrega» significa habilitar el reporte en la aplicación; no presupone correo electrónico. |

El bucket privado `uploads` no interviene en estas rutas: el esquema aprobado guarda los PDF en `reportes.archivo_pdf`. El backend valida que los bytes generados son un PDF y limita el tamaño aceptado. El PDF confirmado y sus destinatarios históricos no se editan ni se eliminan.

## 8. Orden de implementación

1. Base NestJS: configuración, conexión Postgres, manejo de errores, validación, lectura y comprobación de sesión Neon Auth, perfil y rol. Para el uso real de rutas de negocio también se requiere la prueba facial.
2. Deudores y cuentas: consultas restringidas; alta de cuenta, plan y cuotas en una transacción; asignación e historial.
3. Pagos y movimientos: insertar y consultar; saldos y cumplimiento mediante funciones SQL.
4. Pantallas del recorrido anterior en React y paneles con datos reales.
5. Migración de plantilla facial, inscripción, Python, prueba temporal y recuperación. Puede avanzar en paralelo con los módulos anteriores, pero la versión integrada debe exigir verificación antes de dar acceso a rutas de negocio.
6. Borradores y PDF; integración con MCP/LLM; pruebas de permisos, saldos, casos de rechazo y entrega.

## 9. Decisiones y discrepancias a resolver

- El wireframe y el mapa funcional existentes llaman **opcional** al segundo paso facial; la propuesta académica posterior lo declara **obligatorio**. Actualizar esas dos referencias y definir la excepción controlada de primer enrolamiento antes de desarrollar esa pantalla.
- El SQL instalado no tiene tabla facial. Definir modelo, formato y protección de la plantilla, procedimiento de recuperación y validez de la prueba temporal; aplicar su migración en `desarrollo` antes de implementar las rutas faciales.
- La tabla `historial_asignaciones` registra automáticamente **cambios de responsable**. No registra todos los cambios de todas las entidades. Si el requisito «cada cambio» significa auditoría completa, hace falta concretar su alcance y migrar la base; esta API no afirma disponer de un historial genérico inexistente.
- Definir cómo se provisionan/invitan identidades en Neon Auth y cómo se crea de forma controlada el primer administrador. Evitar registro público que asigne `administrador`.
- Definir el contenido exacto del reporte, las métricas, la vigencia de la previsualización y cómo se informa una entrega fuera de la aplicación si más adelante se pide ese canal.

**Fuentes del diseño:** `SolvIA_esquema_final.sql`, `SolvIA_mapa_funcional_y_pantallas.md`, `SolvIA_wireframes.html` y `SolvIA_Practica_3_1_Propuesta_del_Sistema.docx`. Neon Auth gestiona usuarios y sesiones en el esquema `neon_auth`; las decisiones de rol y acceso de SolvIA residen en `perfiles_usuario`.
