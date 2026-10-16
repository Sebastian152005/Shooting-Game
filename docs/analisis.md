# Evolución del proyecto

La revisión inicial encontró responsabilidades mezcladas, recursos dispersos, estilos duplicados y transiciones de combate que necesitaban pruebas.

La implementación actual separa reglas, simulación, adaptadores del navegador, presentación y arranque. Todos los recursos de producción están en `src/`, salvo la entrada `index.html`. CSS tiene una única fuente.

Se incorporaron sonido y récord persistentes, pausa accesible, entradas escalonadas, perfiles conservados entre niveles, recorridos diferenciados, coordinación de ataques, impactos continuos y transiciones de jefe que respetan los ovnis supervivientes. La evolución más reciente añade sesión agrupada, entrada desacoplada, controles táctiles, energía, pulso defensivo, recompensas de jefe, guardado versionado y puntos de entrada ESM.

El detalle vigente está en [arquitectura](arquitectura.md) y [auditoría](auditoria.md). El resto del roadmap sigue en [ideas futuras](ideas-futuras.md).
