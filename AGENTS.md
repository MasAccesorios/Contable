# Reglas Maestras Universales y Memoria Central (DiegoM)

## PILAR 1: Permisos y Modo Autónomo Total (Eager / Turbo)
1. **`autoExecutionPolicy = CASCADE_COMMANDS_AUTO_EXECUTION_EAGER`:** Autorización total y permanente en todos los proyectos. Ejecución directa e inmediata de comandos y herramientas sin tarjetas de confirmación ni botón azul (*Submit / Allow*).
2. **`fileAccessPolicy = AGENT_SETTING_POLICY_ALLOW`:** Lectura y escritura de archivos autorizada sin restricciones en todo el sistema.
3. **`internetPolicy = AGENT_SETTING_POLICY_ALLOW`:** Peticiones y accesos de red autorizados sin restricciones.
4. **`artifactReviewMode = ARTIFACT_REVIEW_MODE_NEVER`:** Ejecución directa y continua sin pausas para revisión intermedia.

---

## PILAR 2: Veracidad Estricta, Lógica y Cero Modificaciones Innecesarias
1. **Veracidad Técnica y Cero Alucinaciones:**
   - Prohibido inventar rutas, comandos, librerías, nombres de variables, versiones o resultados.
   - Toda afirmación técnica debe sustentarse en hechos verificables del sistema, inspección real de archivos o especificaciones oficiales.
   - Si un dato no se conoce o no existe en el entorno, se debe investigar previamente con las herramientas del sistema o declarar con total transparencia técnica.
2. **Principio de Mínima Intervención (No tocar lo que funciona):**
   - Prohibido realizar refactorizaciones cosméticas, reorganizaciones de código no solicitadas o cambiar librerías y estilos funcionales.
   - Resolver exclusivamente el problema encomendado atacando la causa raíz con la menor cantidad de cambios posibles, evitando efectos secundarios.
3. **Lógica Rigurosa y Causa Raíz:**
   - Diagnosticar siempre antes de actuar: analizar logs, flujos y código existente antes de proponer soluciones.
   - Explicaciones y decisiones fundamentadas en lógica de sistemas, sin suposiciones infundadas.

---

## PILAR 3: Calidad de Software, Integridad y Cero Regresiones
1. **Preservación Arquitectural y Cero Regresiones:**
   - Prohibido eliminar, alterar o simplificar funciones auxiliares, validaciones existentes o firmas de métodos sin orden explícita.
   - Analizar siempre el impacto cruzado en todas las vistas, módulos y dependencias antes de aplicar modificaciones.
2. **Verificación Previa de Estado y Fuentes Globales:**
   - Antes de realizar peticiones de red redundantes, recrear estructuras o instanciar datos, verificar si ya residen en memoria, stores, caché o contextos globales de la aplicación.
3. **Idempotencia y Consistencia Bidireccional de Datos:**
   - En cualquier persistencia distribuida o local (IndexedDB, Firebase, Supabase, SQLite, archivos locales), garantizar coherencia bidireccional.
   - Toda creación o mutación de registros debe utilizar IDs únicos deterministas generados en el cliente para prevenir duplicidades ante reintentos o desconexiones.
4. **Modificaciones Quirúrgicas (Cero Sobrescrituras Accidentales):**
   - **En archivos existentes:** Prohibido reescribir el archivo completo. Toda modificación debe aplicarse exclusivamente sobre las líneas afectadas (usando bloques DIFF estándar o herramientas de reemplazo de bloque puntual), garantizando que el resto del código permanezca intacto.
   - **Excepción:** Generación completa permitida únicamente para **archivos nuevos creados desde cero** o cuando el usuario solicite explícitamente una reescritura total.
5. **Ingesta Defensiva de Datos Externos:**
   - Al parsear o consumir fuentes externas (APIs, CSV, JSON, Webhooks, hojas de cálculo), validar y sanitizar siempre la clave primaria o identificador de registro. Asignar fallbacks si los encabezados o registros iniciales vienen vacíos para prevenir colisiones o colapso de UI.
6. **Robustez en Interfaz de Usuario y DOM:**
   - Normalizar acceso a recursos multimedia mediante funciones utilitarias con fallback seguro.
   - En bucles con eventos dinámicos (`onClick`, listeners), congelar siempre constantes locales de bloque (`const currentIdx = i`) para evitar fugas de closure y llamadas a `undefined`.
   - En componentes con transiciones de visibilidad (`display: none` a `display: flex/block`), forzar reflow (`void el.offsetWidth`) antes de alternar clases animadas.

---

## PILAR 4: Eficiencia de Recursos y Ejecución Local
1. **Procesamiento Pesado en la Máquina Local:**
   - Tareas masivas, migraciones o limpiezas de datos se resuelven mediante scripts ejecutables en el PC (PowerShell, Node.js, Python).
   - Prohibido procesar o inyectar payloads de datos de más de 50 KB en el chat de la IA.
2. **Trabajo en Frío y Ahorro de Tokens:**
   - Respuestas directas, estrictamente técnicas, sin saludos de cortesía, sin resúmenes obvios ni teoría innecesaria.
   - No iniciar simulaciones de navegador o entornos virtuales (sandboxes) a menos que se solicite expresamente.

---

## PILAR 5: Entorno de Hardware (Windows 11 & AMD Radeon 780M)
1. **Aceleración Gráfica Forzada:**
   - La GPU AMD Radeon 780M debe mantener la aceleración por hardware activa en Windows y navegadores para renderizado fluido e IA en tiempo real.
2. **Control Riguroso de Memoria RAM:**
   - Mantener procesos limpios: liberación inmediata al cerrar navegadores (`background_mode = false`) y Memory Saver activo para no comprometer Lives ni streamings.
3. **Integridad de Portapapeles y Almacenamiento:**
   - Historial de portapapeles (`Win + V`) activo para flujo ágil de imágenes sin sobrescrituras accidentales.
   - Mantenimiento no destructivo (preservar sesiones, perfiles y cookies).
   - Respeto estricto a las carpetas raíz obligatorias del disco en router Xiaomi AX9000 (Unidad `X:`: `共享`, `下载`, `摄像机监控视频`).

---

## PILAR 6: Ecosistema Universal de Agentes ECC y Orquestación Autónoma
1. **Adopción Mandatoria del Catálogo de 71 Agentes ECC:**
   - Reconocimiento activo y aplicación proactiva de los 71 agentes especializados ECC clasificados en:
     * *Planificación y Arquitectura:* `planner`, `architect`, `code-architect`, `code-explorer`, `code-simplifier`, `type-design-analyzer`, `spec-miner`, `homelab-architect`, `network-architect`, `a11y-architect`.
     * *Revisores Especializados de Código:* `code-reviewer` (calidad general), `security-reviewer` (vulnerabilidades OWASP/secretos), `typescript-reviewer`, `python-reviewer`, `react-reviewer`, `vue-reviewer`, `flutter-reviewer`, `fastapi-reviewer`, `django-reviewer`, `csharp-reviewer`, `go-reviewer`, `rust-reviewer`, `java-reviewer`, `kotlin-reviewer`, `swift-reviewer`, `database-reviewer`, `cpp-reviewer`, `fsharp-reviewer`, `php-reviewer`, `ruby-reviewer`, `harmonyos-app-resolver`, `mle-reviewer`, `rag-pipeline-reviewer`, `healthcare-reviewer`, `bengali-reviewer`.
     * *Resolutores de Build y Compilación:* `build-error-resolver` (TypeScript/tsc general), `react-build-resolver`, `dart-build-resolver`, `django-build-resolver`, `cpp-build-resolver`, `go-build-resolver`, `java-build-resolver`, `kotlin-build-resolver`, `rust-build-resolver`, `swift-build-resolver`, `pytorch-build-resolver`.
     * *Testing, Calidad y Mantenimiento:* `tdd-guide` (ciclo Red-Green-Refactor), `e2e-runner` (Playwright), `performance-optimizer`, `refactor-cleaner`, `commit-reviewer`, `doc-updater`, `docs-lookup`, `pr-test-analyzer`, `silent-failure-hunter`, `loop-operator`, `harness-optimizer`.
2. **Estándar Universal para Proyectos Nuevos y Existentes:**
   - Todo proyecto de desarrollo en el entorno (nuevo o existente) debe disponer de su carpeta `.agents/` (`agents`, `rules`, `skills`, `workflows`) y de su archivo de directivas `AGENTS.md`.
   - **Auto-Aprovisionamiento:** Si se abre o crea un proyecto nuevo o existente que carezca de `.agents/`, se debe auto-aprovisionar de forma inmediata desde el repositorio canónico central (`C:\Users\DiegoM\.agents` o `D:\ECC\.agents`).
3. **Protocolo Operativo de Desarrollo y Flujo de Trabajo:**
   - **Fase 1 (Planificación):** Ante cualquier solicitud de feature nueva, refactorización o cambio arquitectural, activar `planner` / `architect` para desglosar dependencias, riesgos y plan de ejecución.
   - **Fase 2 (TDD):** Implementación guiada por pruebas mediante `tdd-guide`: crear primero los tests fallando (RED), escribir el código mínimo para pasar (GREEN) y refactorizar asegurando cobertura >= 80%.
   - **Fase 3 (Revisión Continua):** Tras escribir o editar código, es mandatario pasar por `code-reviewer`, `security-reviewer` y el revisor de lenguaje especializado del stack correspondiente antes de dar por cerrada la tarea.
   - **Fase 4 (Resolución Quirúrgica de Builds):** Si surge un fallo de compilación o empaquetado, delegar exclusivamente en el `build-error-resolver` respectivo para correcciones mínimas y quirúrgicas sin tocar arquitecturas funcionales.
   - **Fase 5 (Commits):** Validar diffs y formatear según Conventional Commits mediante `commit-reviewer`.
