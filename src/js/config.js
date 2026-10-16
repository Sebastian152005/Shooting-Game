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
                transitionTime: 0.6, blockedTurnDelay: 0.25,
                entryDuration: 1.5, entrySway: 28, bankResponse: 7
            }),
            maxParticles: 10,
            difficultyInterval: 20,
            firstBossLevel: 5,
            progression: Object.freeze({
                maxEnemies: 10, maxEnemyBullets: 72, maxBulletSpeed: 6.2,
                bossRecovery: 2, introDuration: 3, spawnSpacing: 0.65, minimumBossGap: 3,
                enemySeparation: 12, enemyTopMargin: 78, enemyPlayerClearance: 160,
                initialEnemyDepth: 0.3, normalEnemyDepth: 0.4, incursionEnemyDepth: 0.55,
                bossBaseHp: 28, bossHpPerDefeat: 8, bossMaxHp: 84,
                bossShootInterval: 2.7, bossMinimumShootInterval: 1.15,
                bossPhaseIntervalReduction: 0.32, bossWarning: 0.65, bossTopMargin: 82,
                enemyWarning: 0.65, maxChargedAttacks: 1, enemyAttackGap: 0.45,
                enemyAcquisitionTime: 0.24,
                maxSpecialistsPerRole: 2,
                commonDetectionRange: 48, detectionRangePerLevel: 3, maximumDetectionRange: 78,
                specialistDetectionRange: 330,
                precisionMinimumLead: 0.25, precisionMaximumLead: 0.45,
                homingDuration: 0.95, homingTurnRate: 4.2, homingMaxLateralSpeed: 2.25,
                fanWarning: 0.8, fanGapWidth: 150, fanGapPadding: 24,
                fanEdgeMargin: 28, fanShift: 115, maxBulletHeight: 46
            }),
            enemyAttackColors: Object.freeze({
                common: 'lime', aggressor: 'tomato',
                precision: '#FFB347', controller: '#32D5FF'
            }),
            energy: Object.freeze({
                minimum: 0, maximum: 100, initial: 0,
                pickupAmount: 20, firstSpawnDelay: 5,
                spawnDelayMin: 8, spawnDelayMax: 13, fallSpeed: 1.25,
                capsuleRotationSpeed: 1.55,
                pulseCost: 100, pulseRadius: 190,
                pulseVisualDuration: 0.55
            }),
            meteors: Object.freeze({
                unlockLevel: 1, firstSpawnDelay: 2.8,
                spawnDelayMin: 3.8, spawnDelayMax: 5.8, minimumSpawnDelay: 1.8,
                delayReductionPerLevel: 0.18,
                baseSpeed: 1.55, speedPerLevel: 0.13, maximumSpeed: 4.2,
                gravity: 0.38, maximumDrift: 0.32,
                minimumSize: 42, maximumSize: 76,
                maximumConcurrent: 4, pointsPerHit: 35,
                boss: Object.freeze({
                    unlockEncounter: 3, lateEncounter: 5, firstSpawnDelay: 7,
                    spawnDelayMin: 7.5, spawnDelayMax: 10.5, minimumSpawnDelay: 4.5,
                    delayReductionPerEncounter: 0.55,
                    baseSpeed: 1.45, speedPerEncounter: 0.12, maximumSpeed: 3.4,
                    minimumSize: 34, maximumSize: 58,
                    earlyMaximumConcurrent: 1, lateMaximumConcurrent: 2,
                    finalPhaseDelayMultiplier: 0.62, finalPhaseSpeedMultiplier: 1.18,
                    warningDuration: 1.05, burstGap: 0.24,
                    earlyBurstSize: 2, lateBurstSize: 3
                })
            }),
            rewards: Object.freeze({
                optionCount: 2, maxLevel: 4,
                energySpawnReductionPerLevel: 0.07, minimumEnergySpawnMultiplier: 0.72,
                attractionRadiusPerLevel: 12, radiusPerLevel: 18
            }),
            highScoreKey: 'warInSpaceHS',
            progressKey: 'warInSpaceProgress',
            audioSettingsKey: 'warInSpaceAudio',
            audioDefaults: Object.freeze({ music: 0.3, effects: 0.5, muted: false }),
            viewport: Object.freeze({ baseHeight: 540, minWidth: 360, maxPixelRatio: 2 })
        })
    }
}(globalThis))
