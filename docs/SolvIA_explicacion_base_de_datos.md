# SolvIA — explicación de la base de datos

Este documento explica el esquema PostgreSQL de SolvIA instalado en la rama `desarrollo` del proyecto Neon. Describe las diez tablas propias de la aplicación, sus relaciones y las reglas que ya aplica la base de datos. Neon Auth administra las identidades y sesiones en su propio esquema; la aplicación añade únicamente los datos que necesita para la gestión de cartera.

El archivo SQL de referencia es `SolvIA_esquema_final.sql`. Este documento explica su estado actual, no modifica el esquema ni implica que esté instalado en la rama `production`.

## 1. Idea general del modelo

La información se organiza en cinco conjuntos:

1. **Personal y deudores:** `perfiles_usuario` vincula identidades de Neon Auth con roles de SolvIA; `deudores` identifica a las personas ficticias con deuda.
2. **Obligaciones:** `cuentas` representa la deuda original; `planes_pago` y `cuotas` representan el calendario pactado.
3. **Seguimiento financiero:** `pagos` registra importes abonados y `movimientos_saldo` registra cargos, descuentos y correcciones.
4. **Asignación:** `cuentas.responsable_id` indica el gestor actual; `historial_asignaciones` guarda cada cambio de responsable automáticamente.
5. **Reportes:** `reportes` almacena el PDF y `reporte_destinatarios` indica qué gestores deben recibirlo y cuándo se confirmó su entrega.

No existe una columna editable `saldo_actual`, `dias_mora` o `cumplida`: estos resultados dependen de fechas y registros que pueden cambiar, por lo que se calculan a partir de la información vigente.

## 2. Tablas y responsabilidades

| Tabla | Clave principal | Contenido y finalidad |
| --- | --- | --- |
| `perfiles_usuario` | `id UUID` | Usa el mismo ID de `neon_auth."user"`; guarda `rol` (`administrador` o `gestor`) y `activo`. No replica contraseñas ni datos de sesión. |
| `deudores` | `id BIGINT` | Guarda nombre, teléfono, ciudad, segmento, score ficticio y CURP o RFC identificadores. |
| `cuentas` | `id BIGINT` | Vincula deudor, deuda inicial, moneda y fecha de originación. `responsable_id` apunta al gestor actual y `asignacion_modificada_por` al administrador que cambió la asignación. |
| `planes_pago` | `cuenta_id BIGINT` | Guarda la fecha del acuerdo. Su clave es también referencia a `cuentas`, lo que permite un solo plan por cuenta. Los importes y vencimientos pactados están en `cuotas`. |
| `cuotas` | `id BIGINT` | Cada fila guarda número de cuota, vencimiento y monto del plan de una cuenta. |
| `pagos` | `id BIGINT` | Registra cuenta, fecha, importe y gestor que capturó un pago. No modifica retroactivamente el plan. |
| `movimientos_saldo` | `id BIGINT` | Registra intereses, recargos, descuentos, condonaciones, reembolsos, reversiones y ajustes con signo, motivo, fecha y administrador autor. Algunos movimientos se vinculan al pago de origen. |
| `historial_asignaciones` | `id BIGINT` | Guarda cuenta, responsable anterior y nuevo, administrador autor y momento del cambio. Un trigger crea las filas. |
| `reportes` | `id BIGINT` | Guarda título, autor, periodo, fecha de generación y el PDF completo en `archivo_pdf BYTEA`. |
| `reporte_destinatarios` | `(reporte_id, usuario_id)` | Vincula cada reporte con los gestores destinatarios y registra `entregado_en` cuando se confirma la entrega. |

Los IDs `BIGINT` se generan automáticamente. Los importes usan `NUMERIC(16,2)` para conservar centavos; las fechas de negocio usan `DATE` y los instantes de registro usan `TIMESTAMPTZ`. El usuario autenticado se identifica con `UUID`, el tipo comprobado en la instancia real de Neon Auth.

## 3. Relaciones y cardinalidades

| Relación | Cardinalidad y regla |
| --- | --- |
| `neon_auth."user"` → `perfiles_usuario` | Un perfil corresponde a una identidad autenticada. Puede haber una identidad sin perfil hasta completar el alta en SolvIA. |
| `deudores` → `cuentas` | Un deudor puede tener cero o muchas cuentas; cada cuenta pertenece a un deudor. |
| `perfiles_usuario` → `cuentas` | Un gestor puede tener muchas cuentas asignadas; cada cuenta tiene como máximo un responsable actual. La asignación inicial puede quedar pendiente. |
| `cuentas` → `planes_pago` | Cada cuenta válida debe tener exactamente un plan. La existencia del plan se comprueba al cerrar la transacción que crea la cuenta. |
| `planes_pago` → `cuotas` | Un plan debe tener una o más cuotas; sus importes suman exactamente el monto inicial de la cuenta. |
| `cuentas` → `pagos`, `movimientos_saldo`, `historial_asignaciones` | Una cuenta puede acumular cualquier número de estos registros; cada registro pertenece a una cuenta. |
| `pagos` → `movimientos_saldo` | Un pago puede originar movimientos de reembolso o reversión; la clave foránea compuesta garantiza que el movimiento y su pago pertenecen a la misma cuenta. |
| `reportes` ↔ `perfiles_usuario` | Relación muchos a muchos mediante `reporte_destinatarios`. Un reporte guarda el PDF una vez y puede dirigirse a varios gestores. |

Las claves foráneas y las restricciones de borrado conservan la trazabilidad de pagos, movimientos, asignaciones y reportes. La regla del proyecto para usuarios es desactivarlos, no eliminarlos.

## 4. Registro de deudores y cuentas

Un deudor necesita **CURP o RFC**; puede tener ambos. Cada identificador informado debe ser único. El esquema comprueba longitud, mayúsculas y ausencia de espacios exteriores, pero **no verifica la autenticidad oficial** de CURP o RFC porque los deudores son ficticios. `score_buro` es un valor demostrativo obligatorio entre 0 y 1000 y se captura manualmente.

La cuenta almacena el `monto_inicial`, no un saldo que deba mantenerse actualizado a mano. `referencia_externa` es opcional y única cuando se usa; `moneda` admite un código de tres letras y por defecto es `MXN`. Una vez creada, la base impide modificar deudor, importe inicial, moneda y fecha de originación.

### Cuenta, plan y cuotas se registran juntos

El plan tiene `fecha_acuerdo`; cada cuota contiene el importe y su `fecha_vencimiento`. Para crear una cuenta se usa **una sola transacción** que inserta cuenta, plan y todas las cuotas. Al confirmar esa transacción, los triggers diferidos comprueban que:

- existe el plan de la cuenta;
- hay al menos una cuota y todas suman exactamente el monto inicial;
- la numeración empieza en 1 y es consecutiva;
- los vencimientos avanzan en orden y no preceden al acuerdo;
- el acuerdo no precede a la originación cuando esa fecha existe.

Si alguna comprobación falla, la operación no se confirma. Después del alta, plan y cuotas son inmutables: SolvIA no contempla renegociarlos. `planes_pago` solo necesita la referencia a la cuenta y la fecha porque el monto original está en `cuentas` y el calendario e importes están en `cuotas`.

## 5. Gestores y cambios de asignación

La cuenta contiene **solo el responsable actual**. Al crear o cambiar ese responsable, el sistema exige que `asignacion_modificada_por` identifique a un administrador activo y que el nuevo responsable, si existe, sea un gestor activo. Un trigger añade automáticamente una fila a `historial_asignaciones` con el responsable anterior, el nuevo y el administrador que realizó el cambio.

Un gestor con cuentas asignadas no puede desactivarse ni cambiar de rol hasta que se reasignen esas cuentas. El historial no se edita ni se borra. Esto permite mostrar tanto la cartera actual como quién estuvo a cargo en fechas anteriores.

## 6. Pagos, movimientos y saldo

Solo el **gestor activo asignado a la cuenta** puede registrar un pago. El importe debe ser positivo y no superar el saldo pendiente. La fecha del pago debe estar entre la fecha de acuerdo y el día actual. Un pago ya registrado no se edita ni se elimina.

Solo un **administrador activo** registra movimientos de saldo. Cada uno tiene tipo, `impacto_saldo`, fecha efectiva y motivo obligatorio:

- **Aumentan la deuda** con impacto positivo: interés, recargo, reembolso, reversión de pago y ajuste de cargo.
- **Reducen la deuda** con impacto negativo: descuento, condonación y ajuste de abono.

Los reembolsos y reversiones deben señalar un pago de la misma cuenta. La suma de sus importes no puede superar ese pago. Los abonos tampoco pueden llevar el saldo por debajo de cero. Al registrar pagos o movimientos, la base bloquea la fila de la cuenta mientras valida el nuevo saldo para evitar comprobaciones simultáneas inconsistentes.

La función `saldo_cuenta(cuenta_id)` calcula:

```text
saldo = monto_inicial − suma de pagos + suma de impactos de movimientos
```

Por ejemplo, con deuda inicial de 1 000, pagos de 200, un recargo de 50 y un descuento de 50, el saldo es 800. La existencia de un plan no obliga a que todos los pagos coincidan exactamente con una cuota: el gestor decide cuánto abonar a la cuenta, sujeto al saldo y a las reglas de captura.

## 7. Cumplimiento del plan

`resumen_planes(fecha)` calcula por cuenta lo exigible, el crédito aplicado al plan, el saldo, el estado del plan y si la cuenta está liquidada. El cálculo distribuye el crédito disponible a las cuotas según su orden de vencimiento, sin modificar sus registros.

- **Al corriente:** el crédito cubre todo lo que ya es exigible, aunque todavía existan cuotas futuras.
- **Atrasado:** el crédito es menor que la suma de cuotas cuyo vencimiento ya pasó. Una cuota entra en mora al día siguiente del vencimiento.
- **Cubierto:** el crédito alcanza el monto original de las cuotas.
- **Cuenta liquidada:** el saldo total calculado es cero.

`cubierto` y `cuenta_liquidada` son conceptos distintos: un plan podría tener cubierto su monto original y mantener saldo pendiente por cargos posteriores. Por ello la pantalla debe mostrar ambos resultados sin sustituir uno por el otro. No hay una columna persistida de `dias_mora`; cualquier indicador de días se obtendrá de las fechas de las cuotas vencidas.

## 8. Reportes PDF y entregas

`reportes.archivo_pdf` contiene el archivo binario real, no una URL ni una ruta al bucket. La tabla guarda además título, autor, periodo y fecha de generación. La base exige contenido no vacío y, cuando se informa un periodo, que ambas fechas existan y estén ordenadas. La aplicación deberá generar un PDF válido; la restricción de la base solo verifica que existan bytes.

`reporte_destinatarios` añade un registro por gestor destinatario, sin duplicar el PDF. `entregado_en` comienza vacío y puede fijarse una vez, en un instante no anterior a la generación. Actualmente el esquema permite que **cualquier usuario activo** figure como autor de un reporte; si la interfaz limita la generación al administrador, esa restricción adicional deberá imponerse en la aplicación. El bucket `uploads` de Neon no se utiliza para estos PDF en el diseño actual.

## 9. Restricciones, índices y automatización

El esquema usa claves primarias y foráneas, unicidad de CURP/RFC y de `(cuenta_id, numero)` de cuota, comprobaciones de montos y fechas, y restricciones de roles. Los índices aceleran las consultas previstas por deudor, responsable, cuenta, fecha de vencimiento, pago, movimiento, asignación, autor de reporte y destinatario. Las funciones y triggers validan operaciones que dependen de varias tablas; el registro del historial de asignaciones es automático.

**Alcance del historial:** la automatización implementada corresponde a los cambios de **responsable de cuenta**. No existe en este esquema una auditoría genérica de cada columna de todas las tablas. Pagos y movimientos conservan su historial por su propia inmutabilidad.

## 10. Neon Auth y acceso facial

La tabla administrada `neon_auth."user"` proporciona el ID `UUID` que referencia `perfiles_usuario`. Neon Auth conserva sus propios datos de acceso; SolvIA no agrega contraseñas ni sesiones en sus tablas. El campo `activo` y el rol son decisiones de autorización de la aplicación, independientes de la identidad almacenada por Neon Auth.

El **acceso facial opcional todavía no está representado** en las diez tablas instaladas. El diseño acordado requiere una futura tabla separada, vinculada uno a uno a `perfiles_usuario`, para guardar una plantilla facial protegida y la versión del modelo Python. La cámara produce capturas para verificar, pero no se ha acordado almacenar fotografías permanentes. La migración se definirá al elegir el modelo y formato del embedding; hasta entonces no debe suponerse que el esquema actual ya soporta el registro facial.

## 11. Qué queda por concretar

- Modelo de reconocimiento facial, formato de plantilla, proceso de enrolamiento, recuperación y revocación; después, su migración SQL.
- Campos exactos, gráficas y política de generación y entrega de reportes. La base soporta PDF y destinatarios, pero no define el contenido del documento.
- Procedimiento de creación de la primera identidad administradora y del alta de nuevas identidades en Neon Auth.
- Si los PDF alcanzan un volumen que justifique moverlos al bucket. Actualmente el acuerdo es conservarlos en PostgreSQL; cambiarlo exigiría migrar esquema, datos y proceso de descarga.

La base instalada es una **estructura de dominio**, no el sistema completo. Las pantallas y servicios deberán respetar sus reglas y resolver los permisos de consulta y los procesos que aquí se señalan como pendientes.
