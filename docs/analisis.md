# Evolución del proyecto

La revisión inicial encontró responsabilidades mezcladas, recursos dispersos, estilos duplicados y transiciones de combate que necesitaban pruebas.

La implementación actual separa reglas, simulación, adaptadores del navegador, presentación y arranque. Todos los recursos de producción están en `src/`, salvo la entrada `index.html`. CSS tiene una única fuente.

Se incorporaron sonido y récord persistentes, pausa accesible, entradas escalonadas, perfiles conservados entre niveles, recorridos diferenciados, coordinación de ataques, impactos continuos y transiciones de jefe que respetan los ovnis supervivientes.

El detalle vigente está en [arquitectura](arquitectura.md) y [auditoría](auditoria.md). Las funcionalidades nuevas siguen en [ideas futuras](ideas-futuras.md), pendientes de decisión.
