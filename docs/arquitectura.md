# Arquitectura de Shooting-Game

Se aplica el principio de dependencias hacia las reglas internas descrito en [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html). No se presupone una edición «2026»: se aplica ese principio a un juego pequeño de Canvas sin frameworks.

## Responsabilidades

| Ubicación | Responsabilidad |
| --- | --- |
| `src/js/domain/` | Geometría, colocación, impactos, recorridos y perfiles. Reglas sin DOM ni medios. |
| `src/js/application/` | Sesión, tiempos, progresión, apariciones, ataques y entidades. Servicios recibidos por inyección. |
| `src/js/presentation/` | Dibujo, HUD, diálogo, controles de sonido y adaptación del Canvas. |
| `src/js/infrastructure/` | Entrada, almacenamiento, recursos, reproducción y reloj del navegador. |
| `src/js/bootstrap/` | Construcción de servicios y conexión de módulos para cada página. |
| `src/js/config.js` | Datos de configuración compartidos. |

El dominio no depende de la aplicación. La aplicación recibe reglas y servicios; no crea imágenes, audio o diálogos, ni accede directamente a `window`, `document` o `localStorage`. Los adaptadores se conectan al arrancar.

## Contratos

`createGame(services)` recibe `config`, `rules`, `assets`, `storage`, `settings`, `platform` y `randomFloat`. El reloj y los frames llegan mediante `platform.now`, `requestFrame` y `cancelFrame`. Almacenamiento y ajustes son objetos sustituibles en pruebas.

Las entidades guardan identificadores de sprites y estado de combate. Presentación resuelve las imágenes desde el catálogo. Renderizado y simulación están separados. Reiniciar reutiliza los medios cargados y mantiene un único bucle.

Los contratos se expresan con objetos JavaScript y pruebas, sin interfaces TypeScript ni contenedor de inyección. La sesión sigue siendo una fachada compartida por sistemas y entidades; esto simplifica integrar el juego existente, aunque exige disciplina al añadir métodos. No equivale a una separación formal de módulos de un motor grande.

## Páginas

`index.html` es la única página en la raíz. `src/html/game.html` declara `<base href="../../">` para resolver recursos desde la raíz del proyecto. El menú obtiene el destino de su enlace. Recursos y CSS están en sus carpetas dentro de `src/`.

Los HTML declaran el orden de scripts clásicos. Los módulos se registran en `globalThis.ShootingGame`, permitiendo probar las capas internas sin navegador, sin compilación ni descargas.

## Verificación de límites

`tests/project.test.cjs` verifica sintaxis, rutas, carpetas, dependencias y construcción de sesiones con servicios sustituidos. Las pruebas de juego cubren comportamiento y regresiones. Chromium comprueba la composición con DOM, recursos, entrada, sonido y persistencia.

Una regla que depende solo de datos pertenece al dominio. La coordinación temporal pertenece a aplicación. Acceder al navegador corresponde a infraestructura o presentación y se conecta desde bootstrap.
