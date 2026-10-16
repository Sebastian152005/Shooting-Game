(function (app) {
    app.domain = app.domain || {}
    app.domain.progressionProfile = function (level, config) {
        const stage = Math.max(0, level - 1)
        const commonDetectionRange = config.progression.commonDetectionRange ?? 48
        const detectionRangePerLevel = config.progression.detectionRangePerLevel ?? 3
        const maximumDetectionRange = config.progression.maximumDetectionRange ?? 78
        const patterns = level < 2 ? ['patrol'] : level < 3 ? ['patrol', 'sine']
            : level < 4 ? ['sine', 'zigzag'] : ['patrol', 'sine', 'zigzag', 'diver']
        return {
            level, patterns,
            maxEnemies: Math.min(config.progression.maxEnemies, config.maxEnemies + Math.floor(stage / 2)),
            enemySpeed: Math.min(3.6, 1.8 + stage * 0.12),
            bulletSpeed: Math.min(5.4, 2.7 + stage * 0.18),
            shootInterval: Math.max(1.2, 2.8 - stage * 0.12),
            detectionRange: Math.min(maximumDetectionRange,
                commonDetectionRange + stage * detectionRangePerLevel),
            specialistDetectionRange: config.progression.specialistDetectionRange ?? 330,
            aggressors: level >= 2, tracking: level >= 3,
            precision: level >= 4, spread: level >= 6
        }
    }
}(globalThis.ShootingGame))
