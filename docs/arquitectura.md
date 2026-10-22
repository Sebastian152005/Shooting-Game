# Arquitectura de Shooting-Game

Se aplica el principio de dependencias hacia las reglas internas descrito en [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html). No se presupone una edición «2026»: se aplica ese principio a un juego pequeño de Canvas sin frameworks.

## Responsabilidades

| Ubicación | Responsabilidad |
| --- | --- |
| `src/js/domain/` | Geometría, colocación, impactos, energía, peligros, recompensas, recorridos, perfiles y estados de oleada. Reglas sin DOM ni medios. |
| `src/js/application/` | Sesión, entrada abstracta, tiempos, progresión, eventos ambientales, energía, recompensas, apariciones, ataques y entidades. Servicios recibidos por inyección. |
| `src/js/presentation/` | Dibujo, HUD, diálogo, controles de sonido y adaptación del Canvas. |
| `src/js/infrastructure/` | Entrada, almacenamiento, recursos, reproducción y reloj del navegador. |
| `src/js/bootstrap/` | Construcción de servicios y conexión de módulos para cada página. |
| `src/js/config.js` | Datos de configuración compartidos. |

El dominio no depende de la aplicación. La aplicación recibe reglas y servicios; no crea imágenes, audio o diálogos, ni accede directamente a `window`, `document` o `localStorage`. Los adaptadores se conectan al arrancar.

## Contratos

`createGame(services)` recibe `config`, `rules`, `assets`, `storage`, `settings`, `platform` y `randomFloat`. El reloj y los frames llegan mediante `platform.now`, `requestFrame` y `cancelFrame`. Almacenamiento y ajustes son objetos sustituibles en pruebas.

Las entidades guardan identificadores de sprites y estado de combate. Presentación resuelve las imágenes desde el catálogo. Renderizado y simulación están separados. Reiniciar reutiliza los medios cargados y mantiene un único bucle.

El ciclo de oleadas es una máquina de estados de dominio con transiciones explícitas: `intro → wave → boss-pending → boss → recovery → wave`. Una transición no declarada falla inmediatamente; aplicación coordina cuándo emitir cada evento, pero no redefine la regla.

`GameSession` agrupa colecciones, índices, ciclo de vida, progresión, jefe, combo y efectos. La fachada plana de `Game` es un adaptador temporal que conserva compatibilidad mientras cada sistema migra hacia esos grupos.

`InputState` es el puerto común para teclado y controles táctiles. Distingue fuentes simultáneas, acciones sostenidas y comandos de un solo uso; jugador, pausa y pulso consumen el mismo contrato sin conocer el dispositivo.

La progresión persistente usa un esquema versionado y migraciones puras. Energía y recompensas se calculan en dominio; `localStorage`, el diálogo y el Canvas son adaptadores de infraestructura y presentación. El esquema 4 migra la antigua carga inicial y el capacitor de recarga a radio de pulso, garantizando que toda misión comience con el acumulador vacío y que la activación sea inmediata.

`hazards.js` calcula perfiles ambientales y perfiles de meteoritos invocados por jefes sin conocer entidades ni Canvas. `world-events.js` agenda energía, peligros y ráfagas orbitales usando tiempo de juego; `Meteor` contiene únicamente su ciclo de vida físico —aceleración, deriva, impacto y destrucción— y delega el dibujo y el audio. La presentación observa el estado de advertencia del director sin controlar la aparición. Esta separación permite balancear frecuencia, velocidad, resistencia y progresión por encuentro mediante configuración.

`targeting.js` contiene las reglas puras de detección, intercepción y giro. El OVNI común mantiene la presión arcade con un láser vertical por cooldown, sin exigir una alineación predictiva; la predicción queda reservada para agresores y tiradores que muestran un aviso antes de comprometer su trayectoria. El cazador es el único arquetipo autorizado a corregir la trayectoria después del lanzamiento, durante una ventana limitada y con un presupuesto de un proyectil teledirigido activo en oleadas normales. La aplicación decide cuándo preparar el ataque y la presentación asigna a común, cazador y controlador sus identificadores visuales verde, magenta y cian, respectivamente.

Los contratos se expresan con objetos JavaScript y pruebas, sin interfaces TypeScript ni contenedor de inyección. La sesión sigue siendo una fachada compartida por sistemas y entidades; esto simplifica integrar el juego existente, aunque exige disciplina al añadir métodos. No equivale a una separación formal de módulos de un motor grande.

## Páginas

`index.html` es la única página en la raíz. `src/html/game.html` declara `<base href="../../">` para resolver recursos desde la raíz del proyecto. El menú obtiene el destino de su enlace. Recursos y CSS están en sus carpetas dentro de `src/`.

Cada HTML declara un único punto de entrada `type="module"`. `game-entry.js` y `menu-entry.js` son composition roots con imports laterales explícitos; los módulos internos se registran todavía en `globalThis.ShootingGame` como seam de compatibilidad. Esta transición permite un grafo ESM verificable sin bundler ni descargas.

## Verificación de límites

`tests/project.test.cjs` verifica sintaxis, rutas, carpetas, dependencias, transiciones y construcción de sesiones con servicios sustituidos. Las fixtures reutilizables viven en `tests/support/`. Las pruebas de juego cubren comportamiento y regresiones. Chromium comprueba la composición con DOM, recursos, entrada, sonido y persistencia; su runner publica capturas solo tras completar todo el recorrido y registra por separado el estado de la última ejecución.

Una regla que depende solo de datos pertenece al dominio. La coordinación temporal pertenece a aplicación. Acceder al navegador corresponde a infraestructura o presentación y se conecta desde bootstrap.
