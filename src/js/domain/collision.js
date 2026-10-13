(function (app) {
    app.domain = app.domain || {}
    // Sweep an axis-aligned projectile rectangle along its movement segment.
    // Return the first contact in [0, 1], or null for a miss.
    app.domain.projectileContact = function (projectile, movement, target) {
        let entry = 0
        let exit = 1
        for (const [position, delta, low, high] of [
            [projectile.x, movement.x, target.x - projectile.width, target.x + target.width],
            [projectile.y, movement.y, target.y - projectile.height, target.y + target.height]
        ]) {
            if (delta === 0) {
                if (position < low || position > high) return null
                continue
            }
            const first = (low - position) / delta
            const last = (high - position) / delta
            entry = Math.max(entry, Math.min(first, last))
            exit = Math.min(exit, Math.max(first, last))
            if (entry > exit) return null
        }
        return entry
    }
}(globalThis.ShootingGame))
