# Auditoría final del estado actual

Actualizada: 16 de octubre de 2026. Alcance: estructura, dependencias, lógica, recursos, interfaz, almacenamiento, servidor local y composición en Chromium.

## Organización y código

- Entrada única `index.html`; HTML secundario, CSS, JavaScript y recursos en carpetas propias dentro de `src/`.
- Dominio, aplicación, infraestructura, presentación y arranque separados. Servicios inyectados en la sesión y almacenamiento recibido por los ajustes.
- Reglas internas ejecutables sin navegador; renderizado separado de actualización y entidades con identificadores de sprites.
- Rutas actualizadas y fuente única de estilos CSS.
- Reutilización de imágenes y medios, un solo bucle y protección ante diferencias negativas de tiempo.
- Máquina de estados pura para el ciclo de oleadas y fixtures de prueba separadas de los casos de uso.
- `GameSession` agrupado, puerto `InputState` compartido y controles táctiles accesibles.
- Cápsulas de energía acumulable desde cero, pulso defensivo instantáneo contra proyectiles y meteoritos, primeros duelos de jefe limpios y ráfagas orbitales progresivas desde el tercero.
- Energía ambiental independiente de enemigos, feedback sonoro diferenciado y meteoritos continuos con movimiento físico escalable.
- Jefe con silueta reforzada, reactor animado, módulos laterales, anillos orbitales y vida segmentada.
- Un único punto de entrada ES Module por página y grafo de imports comprobado.

## Regresiones comprobadas

- Espera inicial, entradas escalonadas y separación de naves, incluso al reducir la ventana.
- Patrulla, ondas, zigzag e incursiones diferenciadas con reservas de espacio.
- Perfiles de supervivientes conservados al subir de nivel.
- Impactos continuos, consumo único de proyectiles y daño a ovnis visibles durante su entrada.
- Avisos cancelables, huecos reservados y coordinación de cargas peligrosas.
- Jefe que espera a los ovnis pendientes; ataques por vida sin anuncios de fases.
- Pausa y Game Over detienen avances y evitan anuncios superpuestos. Reinicio con clic o Enter.
- Sonido abajo a la derecha, del mismo tamaño que en el menú y disponible en partida solo durante la pausa.
- Persistencia y retorno al menú con ajustes y récord actualizados; manejo de almacenamiento no disponible.
- Foco visible, diálogo, Canvas identificado y movimiento reducido en animaciones ornamentales.
- Servidor con MIME y rangos multimedia, manejo de solicitudes inválidas y exclusión de archivos privados.

## Evidencia

`npm test`: **115 pruebas** —80 de regresión del juego, 5 de entrada, 3 de sesión, 7 de progresión, 4 de eventos ambientales, 2 del grafo ESM, 11 de estructura y 3 de servidor—, con escenarios determinados.

El ensayo Chromium recorre por HTTP el menú, ajustes, inicio, pausa, audio, controles táctiles accesibles, aparición y recolección ambiental de energía, sonidos diferenciados del pulso, caída continua y renderizado de meteoritos, jefe reforzado, combate, tamaño 360 × 780 con densidad 2, recompensa persistente, Game Over, reinicio y retorno al menú. Detecta excepciones JavaScript y recursos locales fallidos. Publica capturas únicamente cuando termina y registra el resultado en `tests/artifacts/browser-smoke-report.json`.

La ejecución final en Chrome 155 completó el recorrido sin excepciones JavaScript ni recursos locales fallidos. El runner desactiva Graphite y sus cachés persistentes para evitar el conflicto de `DawnGraphiteCache` observado en entornos aislados, y conserva un reporte independiente de cualquier fallo de infraestructura.

Comandos y requisitos en [README](../README.md); contratos en [arquitectura](arquitectura.md).

## Límites

Estos resultados respaldan los casos cubiertos; no prueban todas las combinaciones, dispositivos o navegadores. Balance, diversión y lectura visual requieren más partidas reales. Chromium no certifica Safari o Firefox. Los controles táctiles requieren validación adicional en dispositivos físicos.

Los medios dependen del soporte y las políticas del navegador. La aplicación usa ES Modules y requiere HTTP. El servidor incluido es de desarrollo.

No se declara funcionamiento al 100 %. El resultado es una organización verificable, correcciones concretas y una base de regresión reproducible.
