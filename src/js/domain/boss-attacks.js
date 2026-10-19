(function (app) {
    app.domain = app.domain || {}

    const patterns = Object.freeze({
        CLASSIC: 'classic',
        AIMED: 'aimed',
        FAN: 'fan',
        CROSSFIRE: 'crossfire'
    })

    function bossAttackPattern(phase, step) {
        if (phase <= 1) return Math.abs(step) % 3 === 1 ? patterns.AIMED : patterns.CLASSIC
        if (phase === 2) {
            const sequence = [patterns.FAN, patterns.AIMED, patterns.CLASSIC]
            return sequence[Math.abs(step) % sequence.length]
        }
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

    function bossAttackRequiresWarning(pattern) {
        return pattern !== patterns.CLASSIC
    }

    function bossMovementPlan(snapshot = {}) {
        const width = Math.max(1, Number(snapshot.viewportWidth) || 1)
        const bossWidth = Math.max(0, Number(snapshot.bossWidth) || 0)
        const maximumX = Math.max(0, width - bossWidth)
        const phase = Math.max(1, Math.min(3, Number(snapshot.phase) || 1))
        const step = Math.abs(Number(snapshot.step) || 0)
        const side = step % 2 === 0 ? -1 : 1
        const playerX = Number.isFinite(snapshot.playerX) ? snapshot.playerX : width / 2
        const playerVelocity = Number(snapshot.playerVelocity) || 0
        let targetX
        let speedMultiplier
        if (phase === 1) {
            targetX = maximumX * (side < 0 ? 0.16 : 0.84)
            speedMultiplier = 0.86
        } else {
            const lead = phase === 2 ? 0.22 : 0.3
            const offset = width * (phase === 2 ? 0.14 : 0.2) * side
            targetX = playerX + playerVelocity * lead + offset - bossWidth / 2
            speedMultiplier = phase === 2 ? 1 : 1.16
        }
        return Object.freeze({
            targetX: Math.max(0, Math.min(maximumX, targetX)),
            speedMultiplier
        })
    }

    Object.assign(app.domain, {
        BOSS_ATTACK_PATTERNS: patterns,
        bossAttackPattern,
        bossAttackAngles,
        bossAttackRequiresWarning,
        bossMovementPlan
    })
}(globalThis.ShootingGame))
