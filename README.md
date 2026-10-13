# Shooting-Game

**WAR IN SPACE**: juego de naves con JavaScript y Canvas, dificultad progresiva, jefes y récord local.

## Ejecutar

Con Node.js 24 o posterior, ejecuta `npm start` y abre `http://127.0.0.1:8080`. No necesitas instalar paquetes ni compilar. También puedes abrir `index.html` directamente; se recomienda el servidor porque la persistencia bajo `file:` depende del navegador. El sonido requiere interacción y soporte multimedia.

## Estructura

```text
index.html                    Entrada y menú principal
src/
  html/game.html              Página de la partida
  css/                        Estilos comunes, menú y partida
  assets/                     Imágenes, audio y vídeo
  js/
    config.js                 Configuración compartida
    domain/                   Reglas puras
    application/              Sesión, simulación y entidades
    infrastructure/           Entrada, medios, almacenamiento y reloj
    presentation/             Canvas, HUD, ajustes y resolución
    bootstrap/                Composición y arranque
tests/                        Pruebas de juego, estructura, servidor y navegador
tools/                        Servidor local de desarrollo
docs/                         Arquitectura, auditoría e ideas pendientes
```

La partida declara una base relativa a la raíz. Los scripts clásicos comparten `globalThis.ShootingGame` y se cargan en el orden declarado por cada HTML. CSS tiene una única fuente en `src/css/`.

## Controles

| Acción | Control |
| --- | --- |
| Mover | Flechas izquierda/derecha o A/D |
| Disparar | Mantener Espacio |
| Pausar | Clic en el Canvas, P o Esc |
| Continuar | Botón Continuar del diálogo |
| Reiniciar tras Game Over | Clic en el Canvas o Enter |

Cambiar de pestaña o perder el foco pausa la partida. Esc no cierra el diálogo. El sonido aparece abajo a la derecha del menú y, en la partida, solo durante la pausa. Música, efectos, silencio y récord se guardan cuando el almacenamiento está disponible.

## Combate y pantalla

La partida comienza con tres segundos sin enemigos. Las entradas son escalonadas y reservan espacio. No aparece un anuncio de nivel 1. Los niveles posteriores afectan a los nuevos ovnis y conservan el perfil de los supervivientes.

Patrulla, ondas, zigzag e incursiones se introducen por etapas. Los ovnis presionan con disparos simples, controlan espacio mediante abanicos o apuntan con aviso. Destruir al atacante cancela su carga. Los abanicos reservan una zona de escape y las cargas peligrosas se coordinan.

Al preparar un jefe dejan de entrar refuerzos; los ovnis presentes deben ser eliminados. El jefe cambia ataques según su vida, sin textos de fases. Tras derrotarlo hay una recuperación breve.

El Canvas ocupa la ventana y adapta sus coordenadas. La resolución interna usa la densidad de píxeles, limitada a 2 para controlar el coste. El vídeo conserva su proporción.

## Verificación

```sh
npm test
npm run check
npm run test:browser
```

`npm test` ejecuta 92 pruebas de juego, estructura y servidor. `check` comprueba sintaxis, recursos y dependencias. El ensayo de navegador utiliza Chrome o Edge instalado; `CHROME_PATH` permite indicar otro ejecutable Chromium. No usa paquetes externos. Guarda capturas en `tests/artifacts/`, excluidas de Git.

Las pruebas cubren casos concretos y no certifican ausencia absoluta de errores ni sustituyen partidas de evaluación.

Consulta [arquitectura](docs/arquitectura.md), [auditoría final](docs/auditoria.md) e [ideas guardadas](docs/ideas-futuras.md).
