# Reporte de Definición de Proyecto

**Universidad Autónoma de Nuevo León**
**Facultad de Ingeniería Mecánica y Eléctrica**

**Práctica 1.1 — Fundamentos de la inteligencia artificial**

**Ingeniero/a:** Raquel Martínez Martínez
**Materia:** Laboratorio de Temas Selectos de Sistemas Inteligentes
**Equipo:** 3
**Grupo:** 105 &nbsp;&nbsp;|&nbsp;&nbsp; **Hora:** V3 &nbsp;&nbsp;|&nbsp;&nbsp; **Salón:** 4106

| Nombre | Matrícula | Carrera |
|--------|-----------|---------|
| Claudio Jesús Robles Mendo | 2132035 | ITS |
| Juan Daniel Carrillo López | 1945700 | ITS |
| Rubén Mario Lozano Aguilera | 2112146 | ITS |
| Alberto Jairzinho Jáuregui Chio | 2056109 | ITS |
| Josué Alejandro Lara Maldonado | 1999203 | ITS |
| Diego Asael Hernández Cardona | *(pendiente)* | ITS |

---

## 1. Nombre del Proyecto

**SolvIA** — *Sistema Inteligente de Verificación y Seguimiento de Cumplimiento de Pagos*

(Alternativas si se busca otro enfoque: "PagoSeguro AI", "CréditoTrack", "DebtVision")

---

## 2. Descripción

SolvIA es una aplicación web orientada al análisis y seguimiento del cumplimiento de planes de pago de deudores. El sistema permite a los usuarios autorizados (analistas de cobranza, gerentes financieros, etc.) consultar el estado de cada deudor, visualizar su historial de pagos y generar reportes ejecutivos automatizados sobre el comportamiento de pago.

La aplicación se compone de los siguientes módulos:

- **Autenticación biométrica**: en lugar de un login tradicional (usuario/contraseña), el acceso al sistema se realiza mediante **reconocimiento facial**. Una librería de JavaScript (ej. `face-api.js` o `MediaPipe`) se encarga de activar la cámara y detectar la presencia de un rostro en tiempo real en el frontend. Una vez detectado, el frame se envía a un **microservicio en Python** que realiza la extracción de características faciales (embeddings) y la validación/verificación de identidad contra la base de datos de usuarios registrados.

- **Dashboard de datos**: interfaz construida en **React** que muestra gráficas y estadísticas sobre el estado de los deudores: porcentaje de cumplimiento, deudores en mora, tendencias de pago por periodo, distribución por rango de monto adeudado, entre otros indicadores.

- **Backend / API**: desarrollado en **Node.js** (con Express o NestJS), encargado de la lógica de negocio, autenticación de sesiones, gestión de usuarios/deudores y comunicación entre el frontend, la base de datos y los microservicios de Python.

- **Base de datos**: **PostgreSQL**, para almacenar de forma relacional la información de deudores, historial de pagos, planes de pago y usuarios del sistema.

- **Generación de reportes ejecutivos con IA**: desde el **backend (Node.js)**, mediante el protocolo **MCP (Model Context Protocol)** implementado con su SDK de TypeScript, el sistema se conecta a un modelo de lenguaje (LLM) para generar automáticamente un **documento PDF ejecutivo**, que no solo presenta los datos y gráficas solicitadas, sino que incluye una **explicación en lenguaje natural** de lo que representan esos datos (tendencias, riesgos, recomendaciones).

---

## 3. Justificación: ¿Dónde aplica el Sistema Inteligente?

Este proyecto integra al menos **tres componentes de sistemas inteligentes** distintos, lo cual lo hace pertinente para la materia:

### a) Visión por computadora — Detección y reconocimiento facial
- **Detección facial (frontend):** uso de modelos ligeros de detección de rostros en tiempo real sobre el stream de la cámara (redes tipo *BlazeFace* o similares usadas por MediaPipe/face-api.js).
- **Reconocimiento/verificación facial (microservicio Python):** una vez detectado el rostro, se extraen *embeddings* faciales mediante una red neuronal profunda (ej. FaceNet, Dlib o DeepFace) y se comparan contra los embeddings almacenados del usuario, verificando identidad mediante distancia vectorial (ej. distancia coseno o euclidiana). Este es un problema clásico de **clasificación/verificación biométrica** dentro de la IA.

### b) Procesamiento de Lenguaje Natural (NLG) — Generación de reportes ejecutivos
- El uso de un LLM vía MCP para transformar datos estructurados (tablas, estadísticas) en **texto explicativo coherente y contextualizado** es una aplicación directa de *Natural Language Generation*. El sistema no solo reporta números, sino que **interpreta y comunica insights**, algo que tradicionalmente requeriría análisis humano.

### c) (Opcional/extensión futura) Análisis predictivo de riesgo de incumplimiento
- Con los datos históricos almacenados en PostgreSQL, existe una oportunidad natural de extender el proyecto con un modelo de **clasificación o scoring de riesgo** (ej. Regresión Logística, Random Forest) que prediga la probabilidad de que un deudor incumpla su plan de pago, enriqueciendo aún más el componente de "sistema inteligente" del proyecto.

En conjunto, el proyecto no es solo una aplicación CRUD con dashboard: incorpora **percepción (visión)**, **razonamiento/generación (NLP)** y potencialmente **predicción (ML)**, cubriendo distintas ramas de los sistemas inteligentes vistas en la materia.

---

## 4. Cronograma (7 de septiembre – 13 de noviembre)

Duración total: **~9 semanas efectivas de trabajo**, descontando el periodo de exámenes parciales (22 de septiembre – 2 de octubre), en el cual no se realizará ninguna actividad del proyecto.

| Semana | Fechas | Actividad | Entregable |
|--------|--------|-----------|------------|
| 1 | 7 – 11 sept | Diseño de la base de datos (modelo entidad-relación) en PostgreSQL; configuración de repositorios y entornos de desarrollo | Esquema de BD, repos inicializados |
| 2 | 14 – 18 sept | Configuración del backend (NestJS) con endpoints base (CRUD deudores/pagos) y arranque del frontend en React (estructura, rutas, layout del dashboard) | API funcional básica + prototipo navegable del frontend |
| 3 | 21 sept | Arranque del microservicio en Python (FastAPI): estructura base y primer endpoint de prueba | Microservicio Python inicializado |
| — | **22 sept – 2 oct** | **Periodo de exámenes parciales — sin actividades del proyecto** | — |
| 4 | 5 – 9 oct | Detección facial en el navegador (`face-api.js`/`react-webcam`) y desarrollo del reconocimiento/verificación facial en el microservicio Python (DeepFace/OpenCV) | Módulo de detección facial + microservicio de verificación facial funcionando por separado |
| 5 | 12 – 16 oct | Integración del login biométrico end-to-end (frontend ↔ backend ↔ microservicio Python) | Flujo de login facial completo |
| 6 | 19 – 23 oct | Desarrollo de gráficas y estadísticas del dashboard (Recharts) con datos reales; captura de gráficas con `html2canvas` | Dashboard con visualizaciones funcionales |
| 7 | 26 – 30 oct | Integración de MCP + LLM en el backend (Node.js) y construcción del PDF ejecutivo en el frontend (jsPDF/jspdf-autotable) | Generación automática de reporte ejecutivo (borrador) |
| 8 | 2 – 6 nov | Pruebas de integración general, manejo de errores y ajustes de UX/UI | Sistema integrado y estable |
| 9 | 9 – 13 nov | Documentación técnica final, preparación de la presentación y **entrega/presentación del proyecto (13 nov)** | Documentación técnica completa + demo final |

---

## Resumen de Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | React |
| Backend / API | Node.js (Express o NestJS) |
| Base de datos | PostgreSQL |
| Microservicio de IA | Python |
| Reconocimiento facial | Librería JS (detección) + Python (verificación, ej. DeepFace/Dlib) |
| Generación de reportes | MCP + LLM (Node.js) + jsPDF/jspdf-autotable (frontend) |
| Formato de reporte ejecutivo | PDF |

---

## 5. Roles de los Integrantes

| # | Integrante | Rol | Responsabilidades principales |
|---|------------|-----|-------------------------------|
| 1 | Diego Asael Hernández Cardona | Líder de proyecto / Microservicio Python | Coordinación general del equipo, arquitectura y desarrollo del microservicio en Python (FastAPI), toma de decisiones técnicas del proyecto |
| 2 | Alberto Jairzinho Jáuregui Chio | FullStack (NestJS + React) | Desarrollo del backend con NestJS (API, endpoints, modelos de datos con Prisma/PostgreSQL) y del frontend en React, incluyendo el dashboard de gráficas (Recharts) y consumo de la API (TanStack Query) |
| 3 | Rubén Mario Lozano Aguilera | Frontend / UX | Módulo de captura y detección facial en el navegador (`face-api.js`, `react-webcam`), diseño UI/UX (Tailwind/shadcn) |
| 4 | Claudio Jesús Robles Mendo | IA - Reconocimiento facial | Microservicio en Python (FastAPI), verificación facial con DeepFace/OpenCV, integración con el backend |
| 5 | Josué Alejandro Lara Maldonado | IA - Generación de reportes | Integración de MCP + LLM en el backend (Node.js), diseño de prompts, y construcción del PDF ejecutivo en el frontend (jsPDF/jspdf-autotable) |
| 6 | Juan Daniel Carrillo López | QA / Documentación | Pruebas de integración, control de calidad, documentación técnica y preparación de la presentación final |

> *Nota: los roles pueden ajustarse o combinarse según las fortalezas de cada integrante; se recomienda que todos participen al menos parcialmente en la integración final del sistema.*

---

## 6. Librerías y Frameworks Detallados por Capa

### Frontend (React)

- **React + Vite**: base de la aplicación; Vite ofrece un build más rápido y mejor experiencia de desarrollo que Create React App.
- **`face-api.js`** (basada en TensorFlow.js): detección de rostros y landmarks faciales directamente en el navegador, con buena documentación disponible. Alternativa: **MediaPipe Face Detection**, más ligera y con mejor rendimiento, pero con curva de aprendizaje mayor.
- **`react-webcam`**: wrapper de React sobre `getUserMedia` para el manejo declarativo del stream de la cámara.
- **Recharts**: librería de gráficas con componentes declarativos, fácil integración con React, ideal para el dashboard. Alternativa: **Chart.js** (`react-chartjs-2`) si se requiere mayor personalización.
- **TanStack Query (React Query)**: manejo de fetching, cacheo y sincronización de datos provenientes del backend Node y del microservicio Python.
- **Zustand** (opcional): manejo de estado global simple (ej. sesión del usuario autenticado).
- **Tailwind CSS** (+ opcionalmente **shadcn/ui**): estilos y componentes de UI consistentes y de apariencia profesional para el dashboard.
- **`html2canvas`**: permite capturar como imagen (PNG en base64) las gráficas ya renderizadas en el dashboard (Recharts), para reutilizarlas directamente en el PDF ejecutivo. Se recomienda usar `scale: 2` o `3` en la captura para que la imagen no se vea pixeleada dentro del PDF.
- **`jsPDF` + `jspdf-autotable`**: generación del PDF ejecutivo directamente en el navegador, sin pasar por ningún servicio pesado. `jsPDF` inserta el texto explicativo generado por el LLM (recibido desde el backend vía MCP) y las imágenes de las gráficas capturadas con `html2canvas`; `jspdf-autotable` genera la tabla de deudores con paginación automática. Esta combinación evita instalar un navegador headless (como requeriría Puppeteer) solo para generar el PDF, manteniendo el proceso ligero y 100% del lado del cliente.

### Backend (Node.js)

- **NestJS**: framework elegido sobre Express dado el interés en aprenderlo. Su arquitectura modular (controladores, servicios, módulos, inyección de dependencias) facilita separar el sistema en módulos claros (auth, deudores, pagos, reportes) y es más fácil de defender académicamente por forzar buenas prácticas de arquitectura.
- **Prisma**: ORM moderno y type-safe para PostgreSQL, con migraciones automáticas y cliente muy intuitivo. Alternativa nativa de Nest: **TypeORM**.
- **Passport.js (`@nestjs/passport`) + JWT (`@nestjs/jwt`)**: manejo de autenticación mediante una estrategia personalizada que recibe el resultado de la verificación facial del microservicio Python y emite el token de sesión correspondiente.
- **Axios / `HttpModule` de Nest**: comunicación REST con el microservicio Python (verificación facial).
- **class-validator + class-transformer**: validación declarativa de los DTOs de entrada en los endpoints.
- **`@modelcontextprotocol/sdk`** (SDK oficial de MCP en TypeScript): conexión del backend con el LLM para la generación del contenido del reporte ejecutivo (interpretación de datos y redacción en lenguaje natural). El backend solo regresa el texto generado; la construcción del PDF se realiza en el frontend (ver sección de Frontend).

### Microservicio (Python)

- **FastAPI**: framework asíncrono con documentación automática (Swagger/OpenAPI) y validación integrada vía Pydantic; adecuado para no bloquear el procesamiento mientras se analizan imágenes.
- **DeepFace**: librería de alto nivel que envuelve modelos preentrenados (VGG-Face, Facenet, ArcFace, etc.) para verificación facial, sin necesidad de entrenar modelos propios. Alternativa más simple: **`face_recognition`** (basada en `dlib`), aunque algo menos precisa.
- **OpenCV (`opencv-python`)**: preprocesamiento de los frames recibidos desde el frontend (redimensionado, conversión de color, recorte del rostro) antes de pasarlos al modelo de reconocimiento.

> *Nota: el backend (Node.js) obtiene el texto explicativo del reporte vía MCP + LLM; la construcción final del PDF (texto, tabla y gráficas) se hace en el frontend con `jsPDF`/`jspdf-autotable`. El microservicio en Python se enfoca exclusivamente en el reconocimiento facial.*

---

## 7. Conclusión Grupal

Como equipo, consideramos que **SolvIA** representa una oportunidad sólida para aplicar de forma integral los conceptos vistos en la materia de Temas Selectos de Sistemas Inteligentes, ya que no se limita a un solo tipo de tecnología de IA, sino que combina **visión por computadora** (detección y verificación facial para el login biométrico) con **procesamiento de lenguaje natural** (generación automática de reportes ejecutivos mediante MCP y un LLM), dejando además abierta la posibilidad de incorporar un componente de **aprendizaje automático predictivo** como extensión futura del sistema.

La definición del stack tecnológico (React, NestJS, PostgreSQL, un microservicio en Python y la integración de MCP en Node.js) fue producto de decisiones discutidas en equipo, evaluando alternativas de rendimiento y viabilidad — por ejemplo, se descartó migrar el microservicio de Python a C++ al concluir que el cuello de botella real no está en el lenguaje, sino en el modelo de reconocimiento facial, el cual ya corre sobre librerías optimizadas en C/C++ por debajo. Esto nos permitió priorizar el tiempo de desarrollo disponible sobre una optimización que hubiera aportado poco valor real al proyecto.

La distribución de roles busca que cada integrante tenga una responsabilidad clara y alineada a sus fortalezas (liderazgo y microservicio en Python, desarrollo FullStack, frontend/UX, reconocimiento facial, generación de reportes con IA, y QA/documentación), sin dejar de lado la colaboración cruzada necesaria para integrar todos los módulos en un sistema funcional.

Finalmente, el cronograma ajustado a las fechas reales (7 de septiembre – 13 de noviembre), considerando el periodo de exámenes parciales sin actividades, nos obliga a mantener una organización disciplinada del tiempo, priorizando primero los módulos base (base de datos, backend, frontend) para después construir sobre ellos los componentes de inteligencia artificial (reconocimiento facial y generación de reportes), dejando las últimas semanas para pruebas de integración, documentación y la presentación final. Consideramos que, con una buena comunicación y seguimiento semanal del avance de cada integrante, el proyecto es alcanzable dentro del tiempo disponible.