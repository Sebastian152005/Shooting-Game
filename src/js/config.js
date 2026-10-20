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
                entryDuration: 1, entrySway: 28, bankResponse: 7,
                lateralFastEntryMultiplier: 0.65, lateralSmoothEntryMultiplier: 0.95,
                lateralEntryDepthRatio: 0.28,
                trafficCommitDuration: 0.72, trafficLaneResponse: 3.2,
                trafficLaneOffsetRatio: 1.15, trafficDeadlockDuration: 0.65,
                trafficDeadlockStagger: 0.08
            }),
            intensity: Object.freeze({
                cycleDuration: 18, buildupEnd: 0.3, assaultEnd: 0.72,
                buildupFireMultiplier: 1, assaultFireMultiplier: 0.78,
                recoveryFireMultiplier: 1.22,
                adaptive: true, projectileCapacity: 18, meteorCapacity: 4,
                recentDamageWindow: 4, dominanceDelay: 10, smoothingResponse: 1.8,
                overwhelmedThreshold: 0.58, dominantThreshold: 0.2,
                maximumCadenceRelief: 0.15, maximumCadencePressure: 0.1,
                maximumBuildupExtension: 0.06, maximumBuildupReduction: 0.04,
                maximumRecoveryExtension: 0.1, maximumAssaultExtension: 0.06
            }),
            maxParticles: 10,
            difficultyInterval: 20,
            firstBossLevel: 5,
            progression: Object.freeze({
                maxEnemies: 10, maxEnemyBullets: 72, maxBulletSpeed: 6.2,
                bossRecovery: 2, introDuration: 1.2, spawnSpacing: 0.55, minimumBossGap: 3,
                enemySeparation: 12, enemyTopMargin: 78, enemyPlayerClearance: 160,
                initialEnemyDepth: 0.3, normalEnemyDepth: 0.4, incursionEnemyDepth: 0.52,
                incursionDepthPerLevel: 0.025, maximumIncursionDepth: 0.68,
                bossBaseHp: 28, bossHpPerLevel: 2, bossHpPerDefeat: 6, bossMaxHp: 120,
                bossShootInterval: 2.45, bossMinimumShootInterval: 1,
                bossPhaseIntervalReduction: 0.32, bossWarning: 0.65, bossTopMargin: 82,
                bossEntryDuration: 1.15, bossRepositionInterval: 1.25,
                bossMovementDeadzone: 18, bossAcceleration: 520,
                bossMinimumLead: 0.18, bossMaximumLead: 0.38,
                enemyWarning: 0.65, maxChargedAttacks: 2, enemyAttackGap: 0.28,
                enemyAcquisitionTime: 0.24,
                commonSteeringReadiness: 0.68,
                specialistPositioningReadiness: 0.58,
                commonSensorConfidence: 0.3, specialistSensorConfidence: 0.3,
                straightShotToleranceRatio: 0.075, straightShotEngagementRatio: 0.12,
                straightShotMaximumLead: 0.26,
                targetMemoryDuration: 0.55, tacticalDeadzone: 12,
                aggressorFlankOffset: 90,
                marksmanPositionOffset: 75, controllerPositionOffset: 55,
                controllerAimLead: 0.2, specialistAttackSeparation: 170,
                commonLaneSeekMultiplier: 1.22, cadenceVariation: 0.2,
                movementVariation: 0.18,
                maxSpecialistsPerRole: 2, minimumCommonEnemies: 2,
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
