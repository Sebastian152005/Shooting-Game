(function (app) {
    app.domain = app.domain || {}

    function normalizedRandom(randomFloat) {
        const value = Number(randomFloat())
        return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0
    }

    function randomBetween(randomFloat, minimum, maximum) {
        return minimum + (maximum - minimum) * normalizedRandom(randomFloat)
    }

    function nextEnergySpawnDelay(randomFloat, config) {
        return randomBetween(randomFloat, config.spawnDelayMin, config.spawnDelayMax)
    }

    function energySpawnX(randomFloat, viewportWidth, pickupSize = 24) {
        const margin = pickupSize / 2
        return margin + normalizedRandom(randomFloat) * Math.max(0, viewportWidth - pickupSize)
    }

    function meteorProfile(level, config) {
        const difficulty = Math.max(1, Number(level) || 1)
        const stage = Math.max(0, difficulty - config.unlockLevel)
        const delayReduction = stage * config.delayReductionPerLevel
        return {
            enabled: difficulty >= config.unlockLevel,
            delayMin: Math.max(config.minimumSpawnDelay, config.spawnDelayMin - delayReduction),
            delayMax: Math.max(config.minimumSpawnDelay + 0.8, config.spawnDelayMax - delayReduction),
            speed: Math.min(config.maximumSpeed, config.baseSpeed + stage * config.speedPerLevel),
            maximumConcurrent: Math.min(config.maximumConcurrent, 2 + Math.floor(stage / 4)),
            gravity: config.gravity,
            maximumDrift: config.maximumDrift,
            terminalSpeed: config.maximumSpeed * 1.18,
            pointsPerHit: config.pointsPerHit,
            minimumSize: config.minimumSize,
            maximumSize: config.maximumSize
        }
    }

    function nextMeteorSpawnDelay(randomFloat, profile) {
        return randomBetween(randomFloat, profile.delayMin, profile.delayMax)
    }

    function bossMeteorProfile(encounter, phase, config) {
        const bossConfig = config.boss
        const encounterNumber = Math.max(1, Number(encounter) || 1)
        const phaseNumber = Math.max(1, Math.min(3, Number(phase) || 1))
        const stage = Math.max(0, encounterNumber - bossConfig.unlockEncounter)
        const finalPhase = phaseNumber === 3
        const delayReduction = stage * bossConfig.delayReductionPerEncounter
        const delayFactor = finalPhase ? bossConfig.finalPhaseDelayMultiplier : 1
        const speedFactor = finalPhase ? bossConfig.finalPhaseSpeedMultiplier : 1
        const late = encounterNumber >= bossConfig.lateEncounter
        return {
            enabled: encounterNumber >= bossConfig.unlockEncounter,
            finalPhase,
            delayMin: Math.max(bossConfig.minimumSpawnDelay,
                bossConfig.spawnDelayMin - delayReduction) * delayFactor,
            delayMax: Math.max(bossConfig.minimumSpawnDelay + 1,
                bossConfig.spawnDelayMax - delayReduction) * delayFactor,
            speed: Math.min(bossConfig.maximumSpeed,
                (bossConfig.baseSpeed + stage * bossConfig.speedPerEncounter) * speedFactor),
            maximumConcurrent: late
                ? bossConfig.lateMaximumConcurrent : bossConfig.earlyMaximumConcurrent,
            gravity: config.gravity,
            maximumDrift: config.maximumDrift * 0.8,
            terminalSpeed: config.maximumSpeed * 1.08,
            pointsPerHit: config.pointsPerHit,
            minimumSize: bossConfig.minimumSize,
            maximumSize: bossConfig.maximumSize,
            warningDuration: bossConfig.warningDuration,
            burstGap: bossConfig.burstGap,
            burstSize: late ? bossConfig.lateBurstSize : bossConfig.earlyBurstSize
        }
    }

    function createMeteorSpec(randomFloat, viewportWidth, profile) {
        const size = Math.round(randomBetween(randomFloat, profile.minimumSize, profile.maximumSize))
        const x = Math.round(normalizedRandom(randomFloat) * Math.max(0, viewportWidth - size))
        const speedVariance = randomBetween(randomFloat, 0.9, 1.12)
        const spinDirection = normalizedRandom(randomFloat) < 0.5 ? -1 : 1
        const drift = randomBetween(randomFloat, -profile.maximumDrift, profile.maximumDrift)
        return {
            x,
            y: -size,
            size,
            speed: profile.speed * speedVariance,
            angularVelocity: spinDirection * randomBetween(randomFloat, 0.35, 0.85),
            drift,
            gravity: profile.gravity * randomBetween(randomFloat, 0.85, 1.15),
            terminalSpeed: profile.terminalSpeed,
            hp: size >= 66 ? 3 : size >= 52 ? 2 : 1,
            points: profile.pointsPerHit
        }
    }

    Object.assign(app.domain, {
        nextEnergySpawnDelay,
        energySpawnX,
        meteorProfile,
        bossMeteorProfile,
        nextMeteorSpawnDelay,
        createMeteorSpec
    })
}(globalThis.ShootingGame))
