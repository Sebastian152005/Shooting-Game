(function (app) {
    app.domain = app.domain || {}
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
    const ease = value => (1 - Math.cos(Math.PI * clamp(value, 0, 1))) / 2

    app.domain.enemyMotion = function (pattern, time, index, minY, maxY, config) {
        const span = Math.max(0, maxY - minY)
        const center = minY + span / 2
        if (pattern === 'sine') {
            const amplitude = Math.min(config.waveAmplitude, span / 2)
            return { y: center + Math.sin(time * Math.PI * 2 / config.wavePeriod + index * Math.PI / 2) * amplitude, diving: false }
        }
        if (pattern === 'zigzag') {
            const phase = (time / config.zigzagPeriod) % 1
            const triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2
            return { y: minY + span * triangle, diving: false }
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
