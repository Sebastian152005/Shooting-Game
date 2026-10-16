// Native ESM composition root for the menu. Internal modules keep their
// globalThis.ShootingGame registration as a temporary compatibility seam.
import '../config.js'
import '../domain/player-progress.js'
import '../infrastructure/storage.js'
import '../application/settings.js'
import '../presentation/ui/settings.js'

// Keep the legacy bootstrap last: it consumes every dependency above.
import './menu.js'
