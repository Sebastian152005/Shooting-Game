(function (app) {
    app.domain = app.domain || {}
    const overlaps = (a, b, gap = 0) => a.x < b.x + b.width + gap
        && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap
        && a.y + a.height + gap > b.y

    // Pure placement policy: no canvas, audio, session mutation or random source.
    const findPosition = (size, bounds, occupied, preferred, gap, accepts = () => true) => {
        const clampX = x => Math.max(bounds.left, Math.min(bounds.right - size.width, x))
        const clampY = y => Math.max(bounds.top, Math.min(bounds.bottom - size.height, y))
        if (bounds.right - bounds.left < size.width || bounds.bottom - bounds.top < size.height) return null
        const xs = [clampX(preferred.x), bounds.left, bounds.right - size.width]
        const ys = [clampY(preferred.y), bounds.top, bounds.bottom - size.height]
        for (const other of occupied) {
            xs.push(clampX(other.x - size.width - gap), clampX(other.x + other.width + gap))
            ys.push(clampY(other.y - size.height - gap), clampY(other.y + other.height + gap))
        }
        const candidates = []
        for (const x of new Set(xs)) for (const y of new Set(ys)) {
            const candidate = { x, y, width: size.width, height: size.height }
            if (!occupied.some(other => overlaps(candidate, other, gap)) && accepts(candidate)) candidates.push(candidate)
        }
        candidates.sort((a, b) => (a.x - preferred.x) ** 2 + (a.y - preferred.y) ** 2
            - (b.x - preferred.x) ** 2 - (b.y - preferred.y) ** 2)
        return candidates[0] || null
    }
    app.domain.formation = Object.freeze({ overlaps, findPosition })
}(globalThis.ShootingGame))
