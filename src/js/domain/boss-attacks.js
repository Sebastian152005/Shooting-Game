(function (app) {
    app.domain = app.domain || {}

    const patterns = Object.freeze({
        CLASSIC: 'classic',
        AIMED: 'aimed',
        FAN: 'fan',
        CROSSFIRE: 'crossfire'
    })

    function bossAttackPattern(phase, step) {
        if (phase <= 1) return patterns.CLASSIC
        if (phase === 2) return step % 2 === 1 ? patterns.AIMED : patterns.FAN
        const sequence = [patterns.FAN, patterns.AIMED, patterns.CROSSFIRE]
        return sequence[Math.abs(step) % sequence.length]
    }

    function bossAttackAngles(pattern, aim = 0, phase = 1) {
        if (pattern === patterns.CLASSIC) return [-0.35, -0.15, 0, 0.15, 0.35]
        if (pattern === patterns.AIMED) {
            const offsets = phase >= 3 ? [-0.24, -0.12, 0, 0.12, 0.24] : [-0.16, 0, 0.16]
            return offsets.map(offset => offset + aim)
        }
        if (pattern === patterns.CROSSFIRE) {
            return [-0.52, -0.34, aim - 0.1, aim, aim + 0.1, 0.34, 0.52]
                .map(angle => Math.max(-0.62, Math.min(0.62, angle)))
                .sort((a, b) => a - b)
        }
        return []
    }

    Object.assign(app.domain, {
        BOSS_ATTACK_PATTERNS: patterns,
        bossAttackPattern,
        bossAttackAngles
    })
}(globalThis.ShootingGame))
