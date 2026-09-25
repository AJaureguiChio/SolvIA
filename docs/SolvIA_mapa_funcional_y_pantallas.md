# SolvIA — mapa funcional y pantallas

Documento de trabajo para definir los wireframes antes de implementar la interfaz. Integra el proyecto universitario original y las decisiones posteriores sobre Neon Auth, los dos roles y el esquema de base de datos instalado en la rama `desarrollo`.

## Decisiones acordadas

- Los únicos roles de la aplicación son **administrador** y **gestor**. Neon Auth gestiona las identidades y sesiones; `perfiles_usuario` guarda únicamente el rol y el estado activo de cada usuario.
- El reconocimiento facial es una **opción adicional**: primero se inicia sesión con Neon Auth y, para quienes lo activen, se verifica el rostro con cámara y un microservicio Python antes de permitir el acceso a SolvIA.
- Un administrador registra deudores ficticios, con CURP o RFC único y score de buró capturado manualmente; crea cuentas y asigna cada cuenta a un gestor activo. Cada reasignación se registra automáticamente.
- Al registrar una cuenta se establecen un plan y sus cuotas. El plan no se renegocia. El gestor asignado elige la cuenta y el importe de cada pago; la aplicación valida las reglas ya definidas en la base de datos.
- Los movimientos que modifican el saldo (intereses, recargos, descuentos, condonaciones, reembolsos y correcciones) se registran por el administrador. Los pagos y movimientos históricos se conservan.
- Se generan reportes ejecutivos PDF con información y explicación textual. Los PDF se almacenan en `reportes.archivo_pdf` en PostgreSQL. El bucket privado `uploads` existe, pero no forma parte del flujo actual de la aplicación.
- Los usuarios se desactivan; no se eliminan. La predicción de incumplimiento del documento original es una extensión futura.

## Módulos y acceso

| Módulo | Administrador | Gestor |
| --- | --- | --- |
| Acceso | Inicia sesión, configura su propia verificación facial opcional | Inicia sesión, configura su propia verificación facial opcional |
| Panel | Ve indicadores de toda la cartera | Ve indicadores de las cuentas asignadas |
| Deudores | Registra y consulta deudores y score | Consulta deudores relacionados con sus cuentas |
| Cuentas y planes | Crea cuentas junto con plan y cuotas; asigna o reasigna gestores | Consulta las cuentas asignadas y su plan |
| Pagos | Consulta pagos | Registra pagos de sus cuentas |
| Movimientos de saldo | Registra ajustes y correcciones; consulta el historial | Consulta movimientos de sus cuentas |
| Reportes | Genera, almacena, consulta y distribuye PDF | Consulta los reportes recibidos |
| Usuarios | Administra roles y estado activo | Consulta su propio perfil |

## Inventario de pantallas para wireframes

| N.º | Pantalla | Propósito y elementos principales |
| --- | --- | --- |
| 1 | Inicio de sesión | Identificación mediante Neon Auth; acceso a recuperación de cuenta. |
| 2 | Verificación facial | Solicitud de cámara, instrucciones de captura, progreso, resultado y salida por fallo. Solo aparece si el usuario activó esta opción. |
| 3 | Configuración facial | Registrar, comprobar y desactivar la plantilla facial vinculada a la propia cuenta. |
| 4 | Panel del administrador | Indicadores agregados, cuentas en mora, tendencias y acceso a la cartera y reportes. |
| 5 | Panel del gestor | Indicadores y tareas de las cuentas que tiene asignadas. |
| 6 | Lista de deudores | Búsqueda por nombre, CURP o RFC; consulta y registro según el rol. |
| 7 | Registro y detalle de deudor | Identidad ficticia, contacto, ciudad, segmento y score manual; cuentas vinculadas. |
| 8 | Lista de cuentas | Filtros por responsable, cumplimiento y deudor; el gestor ve sus cuentas. |
| 9 | Registro de cuenta y plan | Datos base, elección del deudor, cuotas ordenadas, validación del total y asignación; se guarda como una operación completa. |
| 10 | Detalle de cuenta | Resumen de saldo y cumplimiento; cuotas, pagos, movimientos e historial de asignaciones en secciones. |
| 11 | Registro de pago | Cuenta asignada, fecha, importe y confirmación antes de guardar. |
| 12 | Registro de movimiento | Tipo de ajuste, importe, fecha, motivo y vínculo al pago cuando sea reembolso o reversión. |
| 13 | Gestión de usuarios | Listado, rol y estado activo; reasignación de cuentas antes de desactivar a un gestor. |
| 14 | Lista de reportes | Búsqueda, autor, fecha, periodo, destinatarios y acceso al PDF según permisos. |
| 15 | Generación y entrega de reporte | Periodo y contenido, vista previa, generación, selección de gestores destinatarios y estado de entrega. |

No hace falta una pantalla independiente para modificar el plan, editar pagos históricos o ajustar manualmente el saldo y la mora: el plan es inmutable, los errores se corrigen mediante nuevos movimientos y los indicadores se calculan a partir de los registros.

## Recorridos principales

1. **Alta y asignación:** administrador registra deudor y score → crea cuenta y cuotas → asigna gestor → el gestor encuentra la cuenta en su panel.
2. **Pago:** gestor entra a una cuenta asignada → revisa saldo y cuotas → define importe y fecha → confirma → ve el pago y el saldo actualizado.
3. **Corrección:** administrador abre una cuenta → identifica el pago o saldo que debe corregirse → registra el movimiento con motivo → consulta el nuevo resultado y el historial conservado.
4. **Reporte:** administrador selecciona periodo e información → genera y revisa el PDF → el reporte queda almacenado en PostgreSQL y asociado a sus destinatarios → el gestor consulta el reporte recibido.
5. **Acceso facial opcional:** usuario autenticado activa la opción y registra su rostro → en accesos posteriores inicia sesión con Neon Auth → SolvIA solicita cámara y verifica la captura con Python → entra a la aplicación tras una verificación satisfactoria.

## Reglas de interfaz derivadas del esquema

- Los gestores no deben ver cuentas ajenas ni formularios de ajustes de administrador.
- Solo el gestor activo asignado registra pagos en su cuenta; el importe no puede exceder el saldo pendiente.
- Los planes y cuotas acordados no se editan después del alta; deben sumar el monto inicial de la cuenta.
- El historial de asignación es de consulta: la base de datos lo escribe automáticamente cuando cambia el responsable.
- Los PDF almacenados y las entregas conservan su historial; el administrador ve el estado de entrega y el gestor sus reportes recibidos.

## Decisiones aún abiertas

- **Modelo facial:** biblioteca/modelo Python, formato y dimensión del embedding, criterios de verificación y comprobación de presencia. Esto determina la migración pendiente para una tabla de plantillas faciales ligada uno a uno a `perfiles_usuario`.
- **Recuperación facial:** proceso preciso para volver a registrar el rostro si se pierde la cámara, cambia la apariencia o falla la verificación. La vía Neon Auth debe seguir disponible según las reglas acordadas.
- **Contenido de reportes:** filtros exactos, indicadores, gráficas, plantilla PDF y destinatarios por defecto.
- **Gestión inicial de usuarios:** quién crea o invita la primera cuenta administradora y cómo se registran nuevas identidades mediante Neon Auth.

## Próximo entregable

Wireframes de estas quince pantallas, empezando por navegación y acceso; después, los recorridos de cuentas/pagos y de reportes. El diseño visual y la implementación en React vienen después de validar los wireframes.
