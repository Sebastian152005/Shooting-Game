(function (app) {
    app.domain = app.domain || {}
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
    const ease = value => (1 - Math.cos(Math.PI * clamp(value, 0, 1))) / 2

    app.domain.enemyEntryMotion = function (start, target, elapsed, duration, index, sway, maxX) {
        const progress = clamp(elapsed / Math.max(0.001, duration), 0, 1)
        const eased = progress * progress * (3 - 2 * progress)
        const direction = index % 2 === 0 ? 1 : -1
        const arc = Math.sin(progress * Math.PI) * sway * direction
        // Lateral routes begin wholly outside the viewport. Preserve that
        // off-screen segment instead of snapping the hull onto the first pixel.
        const minimumEntryX = Math.min(0, start.x, target.x)
        const maximumEntryX = Math.max(maxX, start.x, target.x)
        return {
            x: clamp(start.x + (target.x - start.x) * eased + arc,
                minimumEntryX, maximumEntryX),
            y: start.y + (target.y - start.y) * eased,
            progress,
            done: progress === 1
        }
    }

    app.domain.enemyMotion = function (pattern, time, index, minY, maxY, config) {
        const span = Math.max(0, maxY - minY)
        const center = minY + span / 2
        if (pattern === 'sine') {
            const amplitude = Math.min(config.waveAmplitude, span / 2)
            return { y: center + Math.sin(time * Math.PI * 2 / config.wavePeriod + index * Math.PI / 2) * amplitude, diving: false }
        }
        if (pattern === 'zigzag') {
            const phase = (time / config.zigzagPeriod) % 1
            const direction = phase < 0.5 ? phase * 2 : (1 - phase) * 2
            return { y: minY + span * ease(direction), diving: false }
        }
        if (pattern === 'diver') {
            const home = minY + Math.min(config.diveHomeOffset, span * 0.1)
            const cycle = config.diveRest + config.diveDown + config.diveHold + config.diveReturn
            const phase = time % cycle
            const downEnd = config.diveRest + config.diveDown
            const holdEnd = downEnd + config.diveHold
            let progress = 0
            if (phase >= config.diveRest && phase < downEnd) progress = ease((phase - config.diveRest) / config.diveDown)
            else if (phase >= downEnd && phase < holdEnd) progress = 1
            else if (phase >= holdEnd) progress = 1 - ease((phase - holdEnd) / config.diveReturn)
            return { y: home + (maxY - home) * progress, diving: phase >= config.diveRest, home, cycle }
        }
        return { y: center + Math.sin(time * 0.8 + index) * Math.min(5, span / 2), diving: false }
    }
}(globalThis.ShootingGame))
