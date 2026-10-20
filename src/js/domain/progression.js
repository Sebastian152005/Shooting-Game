(function (app) {
    app.domain = app.domain || {}
    app.domain.progressionProfile = function (level, config) {
        const stage = Math.max(0, level - 1)
        const patterns = level < 2 ? ['patrol'] : level < 3 ? ['patrol', 'sine']
            : level < 4 ? ['sine', 'zigzag'] : ['patrol', 'sine', 'zigzag', 'diver']
        return {
            level, patterns,
            maxEnemies: Math.min(config.progression.maxEnemies, config.maxEnemies + Math.floor(stage / 2)),
            enemySpeed: Math.min(3.6, 1.95 + stage * 0.12),
            bulletSpeed: Math.min(5.4, 2.7 + stage * 0.18),
            shootInterval: Math.max(1.15, 2.45 - stage * 0.11),
            maxChargedAttacks: level >= 3 ? config.progression.maxChargedAttacks : 1,
            aggressors: level >= 2, tracking: level >= 3,
            precision: level >= 4, spread: level >= 6
        }
    }

    app.domain.bossHealth = function (level, defeats, config) {
        const levelsBeyondFirstBoss = Math.max(0, level - config.firstBossLevel)
        return Math.min(config.progression.bossMaxHp,
            config.progression.bossBaseHp
            + levelsBeyondFirstBoss * config.progression.bossHpPerLevel
            + Math.max(0, defeats - 1) * config.progression.bossHpPerDefeat)
    }
}(globalThis.ShootingGame))
