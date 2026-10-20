(function (app) {
    app.domain = app.domain || {}

    const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value))

    app.domain.combatPressureTarget = function (telemetry = {}, config = {}) {
        const bullets = clamp((Number(telemetry.hostileProjectiles) || 0)
            / Math.max(1, Number(config.projectileCapacity) || 18))
        const meteors = clamp((Number(telemetry.meteors) || 0)
            / Math.max(1, Number(config.meteorCapacity) || 4))
        const enemies = clamp((Number(telemetry.enemies) || 0)
            / Math.max(1, Number(telemetry.enemyCapacity) || 1))
        const lifeRisk = clamp((Number(telemetry.damageTaken) || 0)
            / Math.max(1, Number(telemetry.maximumDamage) || 1))
        const recentDamage = (Number(telemetry.recentDamageRemaining) || 0) > 0 ? 1 : 0
        return clamp(bullets * 0.35 + meteors * 0.15 + enemies * 0.15
            + lifeRisk * 0.15 + recentDamage * 0.2)
    }

    app.domain.smoothCombatPressure = function (current, target, dt, response = 1.8) {
        const factor = 1 - Math.exp(-Math.max(0, Number(response) || 0) * Math.max(0, Number(dt) || 0))
        return clamp((Number(current) || 0) + (clamp(target) - (Number(current) || 0)) * factor)
    }

    app.domain.combatIntensityProfile = function (elapsed, config, maximumSpecialAttacks = 1, telemetry = null) {
        const duration = Math.max(1, config.cycleDuration)
        const cycle = ((Math.max(0, elapsed) % duration) / duration)
        const adaptive = Boolean(config.adaptive && telemetry)
        const pressure = adaptive ? clamp(Number(telemetry.smoothedPressure) || 0) : 0
        const overwhelmedAt = Number(config.overwhelmedThreshold) || 0.58
        const dominantAt = Number(config.dominantThreshold) || 0.2
        const overwhelmed = adaptive && pressure >= overwhelmedAt
        const dominant = adaptive && pressure <= dominantAt
            && (Number(telemetry.timeSincePlayerHit) || 0) >= (Number(config.dominanceDelay) || 10)
        const relief = overwhelmed ? clamp((pressure - overwhelmedAt) / Math.max(0.01, 1 - overwhelmedAt)) : 0
        const momentum = dominant ? clamp((dominantAt - pressure) / Math.max(0.01, dominantAt)) : 0
        const buildupEnd = clamp(config.buildupEnd
            + relief * (Number(config.maximumBuildupExtension) || 0.06)
            - momentum * (Number(config.maximumBuildupReduction) || 0.04), 0.1, 0.5)
        const assaultEnd = clamp(config.assaultEnd
            - relief * (Number(config.maximumRecoveryExtension) || 0.1)
            + momentum * (Number(config.maximumAssaultExtension) || 0.06), buildupEnd + 0.15, 0.9)

        const phase = cycle < buildupEnd ? 'buildup' : cycle < assaultEnd ? 'assault' : 'recovery'
        const baseMultiplier = phase === 'buildup' ? config.buildupFireMultiplier
            : phase === 'assault' ? config.assaultFireMultiplier : config.recoveryFireMultiplier
        const cadenceAdjustment = relief * (Number(config.maximumCadenceRelief) || 0.15)
            - momentum * (Number(config.maximumCadencePressure) || 0.1)
        const result = {
            phase,
            commonFireMultiplier: baseMultiplier * (1 + cadenceAdjustment),
            specialAttackLimit: phase === 'assault' && !overwhelmed
                ? Math.max(1, maximumSpecialAttacks) : 1
        }
        if (adaptive) {
            result.adaptation = overwhelmed ? 'relief' : dominant ? 'pressure' : 'neutral'
            result.pressure = pressure
        }
        return Object.freeze(result)
    }
}(globalThis.ShootingGame))
