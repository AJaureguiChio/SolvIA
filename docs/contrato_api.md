# SolvIA — contrato propuesto de API

Propuesta para NestJS; ninguna de estas rutas existe aún. Fuentes: SolvIA_mapa_funcional_y_pantallas.md, SolvIA_wireframes.html, SolvIA_explicacion_base_de_datos.md y SolvIA_esquema_final.sql. El esquema protege la integridad; la API agrega autenticación y permisos de lectura.

## Convenciones y errores

Base: /api/v1. Neon Auth gestiona login, logout y recuperación; NestJS verifica la sesión, busca perfiles_usuario y exige activo=true. Los UUID de autor se toman de esa sesión, nunca del cuerpo. Administrador consulta toda la cartera; gestor solo sus cuentas asignadas, deudores vinculados y reportes recibidos. Un recurso ajeno responde 404, incluso en la descarga.

JSON usa snake_case, UUID como texto, BIGINT como texto decimal, NUMERIC(16,2) como texto con dos decimales, fecha YYYY-MM-DD e instante ISO 8601 con zona. Las listas aceptan page=1 y limit=20 por defecto (máximo 100), y responden { "items": [], "page": 1, "limit": 20, "total": 0 }. GET responde 200, POST 201 con el objeto creado y PATCH 200 con el actualizado. Fechas de negocio: America/Mexico_City; la sesión de PostgreSQL debe usar la misma zona para coincidir con CURRENT_DATE. Los resúmenes usan fecha=YYYY-MM-DD u hoy por defecto.

Errores: { "error": { "code": "CODIGO", "message": "Texto legible", "details": { "campo": "motivo" } } }; details puede omitirse. No exponer errores SQL crudos.

| HTTP | Código | Caso |
| --- | --- | --- |
| 400 | INVALID_INPUT | Formato, campo obligatorio o filtro inválido. |
| 401 | UNAUTHENTICATED | Sesión ausente o inválida. |
| 403 | PROFILE_REQUIRED, PROFILE_INACTIVE, FORBIDDEN, FACE_VERIFICATION_REQUIRED | Perfil o permiso insuficiente. |
| 404 | NOT_FOUND | Inexistente o fuera del alcance del gestor. |
| 409 | DUPLICATE_IDENTIFIER, PLAN_INVALID, INVALID_ASSIGNMENT, PAYMENT_INVALID, MOVEMENT_INVALID, USER_HAS_ACCOUNTS, DELIVERY_ALREADY_CONFIRMED | Regla de negocio o unicidad incumplida. |
| 413 | PDF_TOO_LARGE | Archivo por encima del límite configurado. |
| 415 | UNSUPPORTED_MEDIA_TYPE | Tipo de archivo incorrecto. |
| 500 | INTERNAL_ERROR | Fallo inesperado sin detalles internos. |

La API valida temprano, pero los triggers de PostgreSQL son la autoridad final ante concurrencia. No hay rutas para editar o borrar planes, cuotas, pagos, movimientos, historial o reportes, ni para fijar saldo o mora.

## Perfil y usuarios

| Ruta | Permiso | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET /perfil | Ambos | — | 200 { id, rol, activo, verificacion_facial_habilitada }; último campo disponible tras implementar módulo facial. |
| GET /usuarios | Administrador | page, limit, q, rol, activo | 200 lista { id, rol, activo, cuentas_asignadas }; nombre/correo solo si Neon Auth permite leerlos de forma segura. |
| GET /usuarios/{id} | Administrador | — | 200 perfil y cuentas_asignadas. Gestor usa /perfil. |
| POST /usuarios | Administrador | { "auth_user_id": "uuid", "rol": "gestor" } para identidad existente | 201 perfil; duplicado: 409. La primera versión no crea administradores aquí. |
| PATCH /usuarios/{id} | Administrador | rol y/o activo | 200 perfil. No desactivar o cambiar de rol a un gestor con cuentas: 409 USER_HAS_ACCOUNTS. No dejar cero administradores activos. |

### Primer administrador

1. Una persona responsable crea y verifica una identidad con Neon Auth en la rama Neon desarrollo. Un operador obtiene el UUID desde el acceso administrativo, sin formulario público.
2. Un comando privado, de un solo uso, recibe ese UUID por variable de entorno. En una transacción comprueba que la identidad existe en neon_auth."user", que no existe administrador y que ese UUID aún no tiene perfil. Inserta { id: UUID, rol: "administrador", activo: true } en perfiles_usuario.
3. Si una condición falla, revierte sin cambios. Registra solo resultado y UUID, sin credenciales. No se publica como endpoint ni como autorregistro. Cada rama Neon exige ejecución deliberada con su propia identidad.

Luego el administrador usa el mecanismo administrativo de Neon Auth para invitar o crear identidades y POST /usuarios para asociar gestores. Esos dos pasos no comparten transacción SQL; si falla la asociación se reintenta por UUID sin duplicar identidad. La capacidad y el operador de invitaciones de Neon Auth deben concretarse antes de implementar ese flujo.

## Panel y deudores

| Ruta | Permiso | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET /panel | Ambos | fecha opcional | 200 { fecha, cuentas, al_corriente, atrasadas, sin_asignar, proximos_vencimientos, prioridades, pagos_por_periodo, distribucion_plan }. Gestor: solo sus cuentas; sin_asignar solo administrador. Basado en resumen_planes(fecha). |
| GET /deudores | Ambos | page, limit, q por nombre/CURP/RFC | 200 lista { id, nombre, curp, rfc, ciudad, segmento, score_buro, numero_cuentas }. Gestor: solo deudores de sus cuentas. |
| GET /deudores/{id} | Ambos, con alcance | — | 200 datos del deudor y cuentas visibles. |
| POST /deudores | Administrador | { nombre, curp?, rfc?, telefono?, ciudad?, segmento?, score_buro } | 201 deudor. Exige CURP o RFC y score entero 0–1000; identificador duplicado: 409 DUPLICATE_IDENTIFIER. |

pagos_por_periodo: pares { periodo: "YYYY-MM", monto: "0.00" }; distribucion_plan: { estado_plan: "al_corriente|atrasado|cubierto", cuentas: 0 }. Son cálculos, no columnas.

## Cuentas, planes y asignaciones

| Ruta | Permiso | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET /cuentas | Ambos | page, limit, q por referencia/deudor, deudor_id, estado_plan, fecha; responsable_id y sin_asignar solo administrador | 200 lista { id, referencia_externa, deudor: { id, nombre }, responsable_id, monto_inicial, moneda, saldo, estado_plan, cuenta_liquidada }. Gestor: solo asignadas. |
| GET /cuentas/{id} | Ambos, con alcance | fecha opcional | 200 cuenta, deudor, responsable, plan { fecha_acuerdo, cuotas }, saldo, monto_exigible, credito_plan, estado_plan, cuenta_liquidada y totales de pagos y movimientos. |
| POST /cuentas | Administrador | Datos de cuenta y plan { fecha_acuerdo, cuotas: [{ numero, fecha_vencimiento, monto }] } | 201 detalle; inserta cuenta, plan y cuotas en una transacción. |
| PATCH /cuentas/{id}/responsable | Administrador | { "responsable_id": "uuid" o null } | 200 cuenta y última asignación. Autor de sesión; el trigger escribe historial. Sin cambio real: 409 INVALID_ASSIGNMENT. |
| GET /cuentas/{id}/asignaciones | Ambos, con alcance | page, limit | 200 lista { id, responsable_anterior_id, responsable_nuevo_id, realizada_por, realizada_en }. |

Ejemplo de POST /cuentas:

~~~json
{
  "deudor_id": "104",
  "referencia_externa": "CTA-128",
  "producto": "Crédito ficticio",
  "monto_inicial": "1500.00",
  "moneda": "MXN",
  "fecha_originacion": "2026-09-01",
  "responsable_id": null,
  "plan": {
    "fecha_acuerdo": "2026-09-24",
    "cuotas": [
      { "numero": 1, "fecha_vencimiento": "2026-10-24", "monto": "500.00" },
      { "numero": 2, "fecha_vencimiento": "2026-11-24", "monto": "1000.00" }
    ]
  }
}
~~~

Asignación inicial puede quedar pendiente; si se informa gestor, el servidor usa al administrador autenticado como asignacion_modificada_por. Cuotas desde 1, vencimientos estrictamente crecientes no anteriores al acuerdo y suma exacta del monto inicial; acuerdo no anterior a originación. Fallo: 409 PLAN_INVALID. Cuenta base, plan y cuotas no se editan luego. Cada cuota en el detalle puede incluir estado_calculado (pendiente, parcial, cubierta, con indicador de vencida), calculado por crédito aplicado en orden; no se persiste ni reemplaza estado_plan.

## Pagos y movimientos

| Ruta | Permiso | Entrada | Respuesta |
| --- | --- | --- | --- |
| GET /cuentas/{id}/pagos | Administrador o gestor asignado | page, limit | 200 lista { id, fecha_pago, monto, registrado_por, registrado_en }. |
| POST /cuentas/{id}/pagos | Gestor activo asignado | { "fecha_pago": "YYYY-MM-DD", "monto": "500.00" } | 201 { pago, saldo, estado_plan, cuenta_liquidada }. |
| GET /cuentas/{id}/movimientos | Administrador o gestor asignado | page, limit | 200 lista { id, tipo, impacto_saldo, fecha_efectiva, motivo, pago_origen_id, registrado_por, registrado_en }. |
| POST /cuentas/{id}/movimientos | Administrador | { "tipo": "recargo", "importe": "50.00", "fecha_efectiva": "YYYY-MM-DD", "motivo": "...", "pago_origen_id": null } | 201 { movimiento, saldo, estado_plan, cuenta_liquidada }. |

Pago: monto positivo hasta el saldo, fecha entre acuerdo y hoy. Movimiento: importe entra positivo y la API lo transforma a impacto_saldo positivo para interes, recargo, reembolso, reversion_pago, ajuste_cargo; negativo para descuento, condonacion, ajuste_abono. Reembolso y reversión exigen pago_origen_id de la misma cuenta; los demás tipos lo prohíben. La fecha va del acuerdo a hoy y, en reembolso/reversión, no precede al pago. La suma revertida/reembolsada no excede ese pago; un abono no deja saldo negativo. registrado_por proviene de sesión. Después de insertar se releen saldo_cuenta y resumen_planes.

## Reportes PDF y entregas

Primera versión propuesta: NestJS construye PDF con indicadores, texto descriptivo verificable y plantilla fija, y lo guarda en reportes.archivo_pdf. La redacción con IA es ampliación posterior. Deben definirse plantilla y límite de tamaño. entregado_en representa confirmación en la aplicación; no demuestra envío de correo.

| Ruta | Permiso | Entrada | Respuesta |
| --- | --- | --- | --- |
| POST /reportes/vista-previa | Administrador | { titulo, periodo_desde, periodo_hasta, alcance: "cartera|gestor", gestor_id? } | 200 agregados y secciones de texto; no guarda. |
| GET /reportes | Administrador: todos; gestor: recibidos | page, limit, q, periodo_desde, periodo_hasta | 200 lista { id, titulo, generado_por, generado_en, periodo_desde, periodo_hasta, destinatarios }. Gestor solo ve su entrega. |
| POST /reportes | Administrador | Datos de vista previa y destinatario_ids: ["uuid", ...] | 201 reporte y destinatarios; PDF y destinatarios se guardan atómicamente. Gestores activos sin duplicados. |
| GET /reportes/{id} | Administrador o gestor destinatario | — | 200 metadatos y destinatarios visibles según rol. |
| GET /reportes/{id}/archivo | Administrador o gestor destinatario | — | 200 application/pdf, Content-Disposition: attachment; sin URL pública. |
| PATCH /reportes/{id}/destinatarios/{usuario_id}/entrega | Administrador | Cuerpo vacío | 200 { reporte_id, usuario_id, entregado_en }, fijado por servidor. Segunda confirmación: 409 DELIVERY_ALREADY_CONFIRMED. |

alcance gestor exige gestor_id; cartera lo prohíbe. Las fechas de periodo van juntas y ordenadas. Alcance es filtro de generación, no columna actual; el PDF muestra periodo, alcance y fecha.

## Verificación facial opcional: contrato condicionado

Las diez tablas actuales no guardan plantilla, modelo ni enrolamiento. Estas rutas permanecen deshabilitadas hasta definir modelo Python, formato protegido, migración, recuperación y prueba del segundo paso por sesión.

| Ruta propuesta | Permiso | Entrada | Respuesta prevista |
| --- | --- | --- | --- |
| GET /perfil/verificacion-facial | Propio usuario | — | 200 estado no_configurada o habilitada y versión del modelo; sin plantilla ni foto. |
| POST /perfil/verificacion-facial/registro | Propio usuario | Captura temporal según contrato Python | 200 estado habilitado. |
| POST /perfil/verificacion-facial/comprobaciones | Usuario tras Neon Auth | Captura temporal | 200 prueba de segundo paso para la sesión; fallo 403. |
| DELETE /perfil/verificacion-facial | Propio usuario, autenticación reciente | — | 200 estado no_configurada. |

Si está habilitado, NestJS exige prueba facial también en las rutas de negocio. No se conserva foto como credencial. La recuperación debe evitar bloqueo permanente y desactivación sin verificar identidad.

## Recorridos cubiertos

1. Alta: POST /deudores → POST /cuentas → PATCH /cuentas/{id}/responsable si quedó pendiente → GET /cuentas del gestor.
2. Pago: GET /cuentas/{id} → POST /cuentas/{id}/pagos → GET /cuentas/{id}.
3. Corrección: GET /cuentas/{id}/pagos → POST /cuentas/{id}/movimientos → GET /cuentas/{id}/movimientos.
4. Reporte: POST /reportes/vista-previa → POST /reportes → GET /reportes/{id}/archivo → confirmar entrega.
5. Acceso: Neon Auth → GET /perfil → comprobación facial si está habilitada → GET /panel.

