# Auditoría final del estado actual

Fecha: 13 de octubre de 2026. Alcance: estructura, dependencias, lógica, recursos, interfaz, almacenamiento, servidor local y composición en Chromium. Las ideas de funcionalidades nuevas permanecen pendientes.

## Organización y código

- Entrada única `index.html`; HTML secundario, CSS, JavaScript y recursos en carpetas propias dentro de `src/`.
- Dominio, aplicación, infraestructura, presentación y arranque separados. Servicios inyectados en la sesión y almacenamiento recibido por los ajustes.
- Reglas internas ejecutables sin navegador; renderizado separado de actualización y entidades con identificadores de sprites.
- Rutas actualizadas y fuente única de estilos CSS.
- Reutilización de imágenes y medios, un solo bucle y protección ante diferencias negativas de tiempo.

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

`npm test`: **92 pruebas** —80 de juego, 9 de estructura y 3 de servidor—, con escenarios determinados.

El ensayo Chromium recorre menú, ajustes, inicio, pausa, audio, daño durante entrada, combate, tamaño 360 × 780 con densidad 2, supervivientes antes del jefe, Game Over, reinicio y retorno al menú. También abre `index.html` mediante `file:`, navega a la partida, comprueba su sprite y reinicia con Enter. Detecta excepciones JavaScript y recursos locales fallidos. El recorrido aprobado no registró ninguno. Las capturas quedan en `tests/artifacts/`.

Comandos y requisitos en [README](../README.md); contratos en [arquitectura](arquitectura.md).

## Límites

Estos resultados respaldan los casos cubiertos; no prueban todas las combinaciones, dispositivos o navegadores. Balance, diversión y lectura visual requieren más partidas reales. Chromium no certifica Safari o Firefox. No hay controles táctiles.

Los medios dependen del soporte y las políticas del navegador. La persistencia puede restringirse y bajo `file:` depende del navegador; se recomienda el servidor. El servidor incluido es de desarrollo.

No se declara funcionamiento al 100 %. El resultado es una organización verificable, correcciones concretas y una base de regresión reproducible.
