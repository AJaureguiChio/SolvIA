# UNIVERSIDAD AUTÓNOMA DE NUEVO LEÓN
## FACULTAD DE INGENIERÍA MECÁNICA Y ELÉCTRICA

---

### **Reporte de Avance de Proyecto 2 (Práctica 4.1)**
**Laboratorio de Temas Selectos de Sistemas Inteligentes**

* **Docente:** Ing. Raquel Martínez Martínez
* **Materia:** Laboratorio de Temas Selectos de Sistemas Inteligentes (LBTSSI)
* **Grupo:** 105 &nbsp;|&nbsp; **Hora:** V3 &nbsp;|&nbsp; **Salón:** 4106
* **Equipo:** 3

| Nombre | Matrícula | Carrera |
| :--- | :---: | :---: |
| **Alberto Jairzinho Jáuregui Chio** | **2056109** | **ITS** |
| Diego Asael Hernández Cardona | *(pendiente)* | ITS |
| Claudio Jesús Robles Mendo | 2132035 | ITS |
| Juan Daniel Carrillo López | 1945700 | ITS |
| Rubén Mario Lozano Aguilera | 2112146 | ITS |
| Josué Alejandro Lara Maldonado | 1999203 | ITS |

* **Proyecto:** SolvIA — *Sistema Inteligente de Verificación y Seguimiento de Cumplimiento de Pagos*
* **Fecha de entrega:** 9 de octubre de 2026

---

## 1. Resumen Ejecutivo y Objetivo del Avance

El presente documento corresponde al **Avance de Proyecto 2 (Semana 4: 5 – 9 de octubre)** de la plataforma **SolvIA**, de acuerdo con el cronograma oficial establecido en la definición del proyecto.

El objetivo central de este hito consiste en el desarrollo e implementación del **componente de Visión por Computadora e Inteligencia Artificial**, compuesto por dos entregables funcionando por separado:
1. **Microservicio de Verificación Facial en Python (FastAPI + FaceNet/InceptionResnetV1):** Extracción de *embeddings* biométricos de 512 dimensiones, cálculo de similitud vectorial (coseno), almacenamiento de galerías biométricas y endpoints de validación (`/enroll`, `/verify`, `/identify`).
2. **Módulo de Captura y Detección Facial en el Frontend:** Acceso al stream de video (webcam), encuadre visual con control de calidad (iluminación y bounding box) y preparación de frames para autenticación biométrica.

Adicionalmente, se consolida la conexión del backend (NestJS) a la base de datos relacional PostgreSQL (Neon Serverless) con los esquemas y entidades base de usuarios, deudores y registros biométricos.

---

## 2. Seguimiento y Estado del Cronograma

A continuación se presenta la tabla de seguimiento del cronograma a la fecha de corte (**9 de octubre**):

| Semana | Fechas | Actividad Planificada | Entregable Planificado | Estado Actual |
| :---: | :---: | :--- | :--- | :---: |
| **1** | 7 – 11 sept | Diseño de la BD relacional en PostgreSQL; repositorios y entornos. | Esquema de BD, repos inicializados. | **COMPLETADO** |
| **2** | 14 – 18 sept | Backend (NestJS) con endpoints base y frontend en React (layout base). | API funcional básica + prototipo navegable. | **COMPLETADO** |
| **3** | 21 sept | Arranque del microservicio en Python (FastAPI): estructura base. | Microservicio Python inicializado. | **COMPLETADO** |
| **—** | 22 sept – 2 oct | *Periodo de exámenes parciales — sin actividades de proyecto.* | — | **COMPLETADO** |
| **4** | **5 – 9 oct** | **Detección facial en navegador y microservicio de verificación facial en Python.** | **Módulo de detección facial + microservicio de verificación facial funcionando por separado.** | **COMPLETADO (100%)** |
| **5** | 12 – 16 oct | Integración del login biométrico end-to-end (Frontend ↔ Backend ↔ Microservicio IA). | Flujo de login facial completo. | *PRÓXIMO HITO* |
| **6** | 19 – 23 oct | Dashboard de analíticas y gráficas de morosidad (Recharts) con datos reales. | Dashboard con visualizaciones funcionales. | *Pendiente* |
| **7** | 26 – 30 oct | Integración de MCP + LLM en Backend y generación de reporte ejecutivo en PDF. | Generación de reporte ejecutivo con IA. | *Pendiente* |
| **8** | 2 – 6 nov | Pruebas de integración, manejo de errores y afinación de UX/UI. | Sistema integrado y estable. | *Pendiente* |
| **9** | 9 – 13 nov | Documentación final, preparación de presentación y entrega final (13 nov). | Documentación completa + demo final. | *Pendiente* |

---

## 3. Detalle Técnico de los Avances Desarrollados

### 3.1. Microservicio de Inteligencia Artificial (Python + FastAPI)
El microservicio biométrico (`services/ai-service`) se implementó con una arquitectura desacoplada y orientada al alto rendimiento:

* **Framework:** FastAPI (Python 3.11), ejecutado sobre Uvicorn en modo asíncrono.
* **Modelo Neuronal:** Se utilizó **facenet-pytorch** integrando dos redes en cascada:
  1. **MTCNN (Multi-task Cascaded Convolutional Networks):** Detecta la región del rostro en la imagen, evalúa la probabilidad de confianza del detector y alinea las coordenadas faciales a una dimensión estandarizada de $160 \times 160$ píxeles.
  2. **Inception-ResNet-v1 (preentrenado con VGGFace2):** Red convolucional profunda que mapea el rostro alineado a un vector compacto (*embedding*) de **512 dimensiones** en el espacio latente.
* **Normalización Vectorial y Función de Distancia:**
  Cada vector obtenido se normaliza a norma unitaria ($L_2 = 1$):
  $$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2}$$
  La métrica de comparación entre el vector capturado (*probe*) $\mathbf{a}$ y el vector de referencia (*gallery*) $\mathbf{b}$ es la **Similitud Coseno**:
  $$\text{Sim}(\mathbf{a}, \mathbf{b}) = \frac{\mathbf{a} \cdot \mathbf{b}}{\|\mathbf{a}\| \|\mathbf{b}\|} = \mathbf{a} \cdot \mathbf{b} \quad (\text{dado que } \|\mathbf{a}\| = \|\mathbf{b}\| = 1)$$
* **Estrategia "Best of N":**
  Para cada usuario se almacena una galería de $k$ muestras fotográficas ($k=4$). En el proceso de verificación 1:1, se calcula:
  $$\text{Score} = \max_{j \in \{1,\dots,k\}} \text{Sim}(\mathbf{p}, \mathbf{g}_j)$$
  Si $\text{Score} \ge \text{MATCH\_THRESHOLD}$, se dictamina identidad positiva (`match = True`).

#### Endpoints Implementados y Probados:
* `GET /health`: Monitoreo del estado del servicio y pesos del modelo cargados en memoria.
* `POST /enroll`: Registro biométrico del usuario. Recibe identificador y lista de imágenes en Base64. Realiza filtros de calidad (`min_det_score = 0.90`, `min_face_px = 80px`), rechaza imágenes con cero o múltiples caras, y persiste los embeddings válidos en almacenamiento `.npz`.
* `POST /verify`: Verificación 1:1. Recibe `user_id` y frame en Base64; contrasta el embedding contra la galería del usuario y responde `{ "match": true/false, "score": float }`.
* `POST /identify`: Identificación 1:N. Compara el rostro contra todos los usuarios registrados y devuelve el candidato con mayor probabilidad.

---

### 3.2. Calibración Empírica del Umbral de Decisión (Script de Experimento)
Para validar el comportamiento del sistema inteligente, se desarrolló el script `scripts/experiment.py`, evaluando distancias intra-clase (fotos de la misma persona) e inter-clase (fotos de personas distintas):

* **Distribución Intra-clase (Genuinos - Tu vs Tu):**
  Puntajes observados en el rango de **0.62 a 0.88**.
* **Distribución Inter-clase (Impostores - Tu vs Compañeros):**
  Puntajes observados en el rango de **0.12 a 0.28**.
* **Margen de Separación (*Gap*):**
  Se constató una separación neta superior a **0.34**, lo que permite fijar con seguridad un umbral de:
  $$\text{MATCH\_THRESHOLD} = 0.40 - 0.45$$
  garantizando una tasa de falsa aceptación (FAR) tendiente a 0% sin disparar la tasa de falso rechazo (FRR).

---

### 3.3. Módulo de Captura y Detección Facial en el Navegador (Frontend)
Para el cliente web se estructuró el componente de captura de cámara (`BiometricScanner`):
* Inicialización del stream de video del usuario mediante la API estándar `navigator.mediaDevices.getUserMedia`.
* Renderizado de una máscara visual de encuadre (*bounding guide*) para guiar al usuario a centrar su rostro.
* Captura de frames en resolución nativa mediante `canvas`, serialización a formato Base64 (JPEG) y empaquetado para consumo del microservicio de autenticación.
* Manejo de retroalimentación en UI: detección activa, advertencias de iluminación y confirmación de captura.

---

### 3.4. Backend y Persistencia Relacional (PostgreSQL en Neon)
En paralelo a la IA, se consolidó la infraestructura de datos:
* **Conexión a Neon PostgreSQL:** Configuración exitosa del cliente `@neondatabase/serverless` y conexión al pool de base de datos.
* **Modelo Relacional:** Despliegue del esquema con tablas `usuarios`, `roles`, `deudores`, `planes_pago`, `pagos` y `sesiones`.
* **Módulos de NestJS:** Estructuración de los módulos `AuthModule`, `UsuariosModule`, `DeudoresModule`, `PagosModule`, `FacialModule` y `DatabaseModule`, integrando Guards de autenticación y validación de roles.

---

## 4. Evidencias de Funcionamiento

1. **Pruebas de Carga del Modelo en Microservicio:**
   * Carga en frío del modelo FaceNet (Inception-ResNet-v1 preentrenado en VGGFace2) completada con éxito.
   * Procesamiento de embeddings unitarios con tiempo de inferencia de ~120 ms en CPU.
2. **Pruebas Unitarias de Verificación Biométrica:**
   * Vectores idénticos: Similitud Coseno $= 1.0000 \to \text{match} = \text{True}$.
   * Vectores ortogonales/disímiles: Similitud Coseno $< 0.30 \to \text{match} = \text{False}$.
3. **Repositorio Git Sincronizado:**
   * Monorepo sincronizado con las ramas de desarrollo, documentación de arquitectura (`SolvIA_esquema_final.sql`, `SolvIA_contrato_API_v1.md`) y estructura del servicio de IA en `services/ai-service`.

---

## 5. Conclusiones y Próximos Pasos

El avance de la **Semana 4** se cumplió satisfactoriamente al 100%. Se cuenta con los dos pilares solicitados por el cronograma para esta fecha: el microservicio en Python capaz de extraer características biométricas y calcular distancias de verificación, y el módulo de captura de video en el cliente.

**Plan de Trabajo para la Semana 5 (12 – 16 de octubre):**
* Integración **end-to-end** del login biométrico:
  1. El frontend captura el frame del usuario.
  2. El backend en NestJS recibe la solicitud y la redirige al microservicio Python.
  3. El microservicio valida la identidad contra los embeddings registrados.
  4. Si la verificación es exitosa, NestJS emite un JWT de sesión con el rol correspondiente del analista.
