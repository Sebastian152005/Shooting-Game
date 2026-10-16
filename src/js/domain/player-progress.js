(function (app) {
    app.domain = app.domain || {}

    const PROGRESS_SCHEMA_VERSION = 4
    const REWARD_IDS = Object.freeze(['pulse-efficiency', 'energy-harvest', 'pulse-radius'])
    const REWARD_DEFINITIONS = Object.freeze([
        Object.freeze({ id: 'pulse-efficiency', title: 'Frecuencia cuantica', description: 'Las capsulas de energia aparecen con mayor frecuencia.' }),
        Object.freeze({ id: 'energy-harvest', title: 'Iman de energia', description: 'Amplia la distancia desde la que recoges capsulas.' }),
        Object.freeze({ id: 'pulse-radius', title: 'Onda expansiva', description: 'Amplia el radio del pulso defensivo.' })
    ])

    function emptyRewards() {
        return REWARD_IDS.reduce((levels, id) => { levels[id] = 0; return levels }, {})
    }

    function safeLevel(value, maximum) {
        const level = Number(value)
        return Number.isSafeInteger(level) ? Math.max(0, Math.min(maximum, level)) : 0
    }

    function createDefaultProgress() {
        return { schemaVersion: PROGRESS_SCHEMA_VERSION, bossesDefeated: 0, rewards: emptyRewards() }
    }

    function migrateProgress(candidate, maximumLevel = 4) {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return createDefaultProgress()

        let source = candidate
        const version = Number(candidate.schemaVersion ?? candidate.version ?? 0)
        if (version <= 0) {
            source = {
                schemaVersion: 1,
                bossVictories: candidate.bossWins,
                rewardLevels: candidate.upgrades
            }
        }
        if (Number(source.schemaVersion) === 1) {
            source = {
                schemaVersion: 2,
                bossesDefeated: source.bossVictories,
                rewards: source.rewardLevels
            }
        }
        if (Number(source.schemaVersion) === 2) {
            source = {
                schemaVersion: 3,
                bossesDefeated: source.bossesDefeated,
                rewards: {
                    ...source.rewards,
                    'pulse-radius': source.rewards?.['pulse-radius'] ?? source.rewards?.['initial-charge']
                }
            }
        }
        if (Number(source.schemaVersion) === 3) {
            const priorRewards = source.rewards && typeof source.rewards === 'object' ? source.rewards : {}
            source = {
                schemaVersion: PROGRESS_SCHEMA_VERSION,
                bossesDefeated: source.bossesDefeated,
                rewards: {
                    ...priorRewards,
                    'pulse-radius': Math.max(Number(priorRewards['pulse-radius']) || 0,
                        Number(priorRewards['pulse-capacitor']) || 0)
                }
            }
        }
        if (Number(source.schemaVersion) !== PROGRESS_SCHEMA_VERSION) return createDefaultProgress()

        const rewards = emptyRewards()
        const incomingRewards = source.rewards && typeof source.rewards === 'object' ? source.rewards : {}
        for (const id of REWARD_IDS) rewards[id] = safeLevel(incomingRewards[id], maximumLevel)
        const bossesDefeated = Number(source.bossesDefeated)
        return {
            schemaVersion: PROGRESS_SCHEMA_VERSION,
            bossesDefeated: Number.isSafeInteger(bossesDefeated) && bossesDefeated >= 0 ? bossesDefeated : 0,
            rewards
        }
    }

    function rewardOptions(progress, count, randomFloat = Math.random, maximumLevel = 4) {
        const normalized = migrateProgress(progress, maximumLevel)
        let available = REWARD_DEFINITIONS.filter(reward => normalized.rewards[reward.id] < maximumLevel)
        if (available.length < count) available = REWARD_DEFINITIONS.slice()
        if (!available.length || count <= 0) return []
        const start = Math.floor(Math.max(0, Math.min(0.999999, Number(randomFloat()) || 0)) * available.length)
        const ordered = available.slice(start).concat(available.slice(0, start))
        return ordered.slice(0, Math.min(count, ordered.length)).map(reward => ({
            ...reward,
            level: normalized.rewards[reward.id],
            maxLevel: maximumLevel
        }))
    }

    function applyReward(progress, rewardId, maximumLevel = 4) {
        const next = migrateProgress(progress, maximumLevel)
        if (!REWARD_IDS.includes(rewardId)) return next
        next.rewards[rewardId] = Math.min(maximumLevel, next.rewards[rewardId] + 1)
        return next
    }

    function rewardEffects(progress, energyConfig, rewardConfig) {
        const normalized = migrateProgress(progress, rewardConfig.maxLevel)
        return {
            pulseCost: energyConfig.pulseCost,
            pickupAmount: energyConfig.pickupAmount,
            energySpawnIntervalMultiplier: Math.max(rewardConfig.minimumEnergySpawnMultiplier,
                1 - normalized.rewards['pulse-efficiency'] * rewardConfig.energySpawnReductionPerLevel),
            pickupAttractionRadius: normalized.rewards['energy-harvest'] * rewardConfig.attractionRadiusPerLevel,
            pulseRadius: energyConfig.pulseRadius
                + normalized.rewards['pulse-radius'] * rewardConfig.radiusPerLevel
        }
    }

    Object.assign(app.domain, {
        PROGRESS_SCHEMA_VERSION, REWARD_DEFINITIONS,
        createDefaultProgress, migrateProgress, rewardOptions, applyReward, rewardEffects
    })
}(globalThis.ShootingGame))
