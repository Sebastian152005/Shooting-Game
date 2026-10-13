(function (root) {
    const POWERUP_TYPES   = Object.freeze(['rapidfire', 'shield', 'triple', 'bomb'])
    const POWERUP_COLORS  = Object.freeze({ rapidfire: '#FF8C00', shield: '#00BFFF', triple: '#9B30FF', bomb: '#FF2222' })
    const POWERUP_LABELS  = Object.freeze({ rapidfire: '⚡ RAPIDFIRE', shield: '◈ ESCUDO', triple: '⊕ TRIPLE', bomb: '✸ BOMBA!' })
    const POWERUP_ICONS   = Object.freeze({ rapidfire: '⚡', shield: '◈', triple: '⊕', bomb: '✸' })

    root.ShootingGame = {
        entityFactories: {},
        config: Object.freeze({
            POWERUP_TYPES, POWERUP_COLORS, POWERUP_LABELS, POWERUP_ICONS,
            maxLives: 5,
            maxEnemies: 6,
            enemySize: Object.freeze({ width: 100, height: 60 }),
            motion: Object.freeze({
                waveAmplitude: 35, wavePeriod: 3.2, zigzagPeriod: 2.8,
                diveHomeOffset: 8, diveRest: 0.9, diveDown: 1.1, diveHold: 0.2, diveReturn: 1.4,
                transitionTime: 0.6, blockedTurnDelay: 0.25
            }),
            maxParticles: 10,
            difficultyInterval: 20,
            firstBossLevel: 5,
            progression: Object.freeze({
                maxEnemies: 10, maxEnemyBullets: 72, maxBulletSpeed: 6.2,
                bossRecovery: 2, introDuration: 3, spawnSpacing: 0.65, minimumBossGap: 3,
                enemySeparation: 12, enemyTopMargin: 78, enemyPlayerClearance: 160,
                initialEnemyDepth: 0.3, normalEnemyDepth: 0.4, incursionEnemyDepth: 0.55,
                bossBaseHp: 12, bossMaxHp: 40, bossWarning: 0.65,
                enemyWarning: 0.65, maxChargedAttacks: 1, enemyAttackGap: 0.45,
                maxSpecialistsPerRole: 2,
                fanWarning: 0.8, fanGapWidth: 150, fanGapPadding: 24,
                fanEdgeMargin: 28, fanShift: 115, maxBulletHeight: 46
            }),
            highScoreKey: 'warInSpaceHS',
            audioSettingsKey: 'warInSpaceAudio',
            audioDefaults: Object.freeze({ music: 0.3, effects: 0.5, muted: false }),
            viewport: Object.freeze({ baseHeight: 540, minWidth: 360, maxPixelRatio: 2 })
        })
    }
}(globalThis))
