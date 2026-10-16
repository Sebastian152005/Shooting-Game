(function (app) {
    const SESSION_STATE_PATHS = Object.freeze({
        bullets: Object.freeze(['collections', 'bullets']),
        enemyBullets: Object.freeze(['collections', 'enemyBullets']),
        enemies: Object.freeze(['collections', 'enemies']),
        particles: Object.freeze(['collections', 'particles']),
        meteors: Object.freeze(['collections', 'meteors']),
        powerUps: Object.freeze(['collections', 'powerUps']),
        floatingTexts: Object.freeze(['collections', 'floatingTexts']),
        pendingSpawns: Object.freeze(['collections', 'pendingSpawns']),

        bulletIndex: Object.freeze(['indices', 'bullet']),
        enemyBulletIndex: Object.freeze(['indices', 'enemyBullet']),
        enemyIndex: Object.freeze(['indices', 'enemy']),
        particleIndex: Object.freeze(['indices', 'particle']),
        meteorIndex: Object.freeze(['indices', 'meteor']),
        powerUpIndex: Object.freeze(['indices', 'powerUp']),
        floatingTextIndex: Object.freeze(['indices', 'floatingText']),

        color: Object.freeze(['lifecycle', 'color']),
        maxParticles: Object.freeze(['lifecycle', 'maxParticles']),
        maxEnemies: Object.freeze(['lifecycle', 'maxEnemies']),
        enemiesAlive: Object.freeze(['lifecycle', 'enemiesAlive']),
        currentFrame: Object.freeze(['lifecycle', 'currentFrame']),
        maxLives: Object.freeze(['lifecycle', 'maxLives']),
        life: Object.freeze(['lifecycle', 'life']),
        score: Object.freeze(['lifecycle', 'score']),
        highScore: Object.freeze(['lifecycle', 'highScore']),
        paused: Object.freeze(['lifecycle', 'paused']),
        isGameOver: Object.freeze(['lifecycle', 'isGameOver']),
        isNewRecord: Object.freeze(['lifecycle', 'isNewRecord']),

        difficulty: Object.freeze(['progression', 'difficulty']),
        levelUpTimer: Object.freeze(['progression', 'levelUpTimer']),
        levelFlash: Object.freeze(['progression', 'levelFlash']),
        lastTimestamp: Object.freeze(['progression', 'lastTimestamp']),
        elapsedTime: Object.freeze(['progression', 'elapsedTime']),
        waveStage: Object.freeze(['progression', 'waveStage']),
        introRemaining: Object.freeze(['progression', 'introRemaining']),
        spawnCooldown: Object.freeze(['progression', 'spawnCooldown']),
        recoveryTime: Object.freeze(['progression', 'recoveryTime']),
        enemyAttackCooldown: Object.freeze(['progression', 'enemyAttackCooldown']),
        enemyAttackTurn: Object.freeze(['progression', 'enemyAttackTurn']),
        safeCorridor: Object.freeze(['progression', 'safeCorridor']),
        incursion: Object.freeze(['progression', 'incursion']),
        progressionTime: Object.freeze(['progression', 'progressionTime']),
        nextDifficultyAt: Object.freeze(['progression', 'nextDifficultyAt']),
        bannerMessage: Object.freeze(['progression', 'bannerMessage']),
        bannerDuration: Object.freeze(['progression', 'bannerDuration']),

        boss: Object.freeze(['bossEncounter', 'boss']),
        bossActive: Object.freeze(['bossEncounter', 'active']),
        bossCount: Object.freeze(['bossEncounter', 'count']),
        nextBossAt: Object.freeze(['bossEncounter', 'nextAt']),

        combo: Object.freeze(['combo', 'hits']),
        comboTimer: Object.freeze(['combo', 'timer']),
        comboMultiplier: Object.freeze(['combo', 'multiplier']),
        comboScale: Object.freeze(['combo', 'scale']),

        shakeTimer: Object.freeze(['effects', 'shakeTimer']),
        blinkTimer: Object.freeze(['effects', 'blinkTimer']),
        blinkVisible: Object.freeze(['effects', 'blinkVisible']),
        dt: Object.freeze(['effects', 'deltaTime']),

        energySpawnRemaining: Object.freeze(['environment', 'energySpawnRemaining']),
        meteorSpawnRemaining: Object.freeze(['environment', 'meteorSpawnRemaining'])
    })

    // Pure factory: all environment-dependent values are resolved by the caller.
    function createSessionState({ config, waveStages, highScore = 0 }) {
        return {
            collections: {
                bullets: {},
                enemyBullets: {},
                enemies: {},
                particles: {},
                meteors: {},
                powerUps: {},
                floatingTexts: {},
                pendingSpawns: []
            },
            indices: {
                bullet: 0,
                enemyBullet: 0,
                enemy: 0,
                particle: 0,
                meteor: 0,
                powerUp: 0,
                floatingText: 0
            },
            lifecycle: {
                color: 'rgba(20,20,20,.7)',
                maxParticles: config.maxParticles,
                maxEnemies: config.maxEnemies,
                enemiesAlive: 0,
                currentFrame: 0,
                maxLives: config.maxLives,
                life: 0,
                score: 0,
                highScore,
                paused: false,
                isGameOver: false,
                isNewRecord: false
            },
            progression: {
                difficulty: 1,
                levelUpTimer: 0,
                levelFlash: 0,
                lastTimestamp: 0,
                elapsedTime: 0,
                waveStage: waveStages.INTRO,
                introRemaining: config.progression.introDuration,
                spawnCooldown: 0,
                recoveryTime: 0,
                enemyAttackCooldown: 0,
                enemyAttackTurn: 0,
                safeCorridor: null,
                incursion: null,
                progressionTime: 0,
                nextDifficultyAt: config.difficultyInterval,
                bannerMessage: null,
                bannerDuration: 3
            },
            bossEncounter: {
                boss: null,
                active: false,
                count: 0,
                nextAt: config.firstBossLevel
            },
            combo: {
                hits: 0,
                timer: 0,
                multiplier: 1,
                scale: 1
            },
            effects: {
                shakeTimer: 0,
                blinkTimer: 0,
                blinkVisible: true,
                deltaTime: 1 / 60
            },
            environment: {
                energySpawnRemaining: 0,
                meteorSpawnRemaining: 0
            }
        }
    }

    // Compatibility seam for systems that still consume the original flat Game API.
    function attachSessionState(target, state) {
        Object.defineProperty(target, 'sessionState', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: state
        })
        for (const [property, [group, field]] of Object.entries(SESSION_STATE_PATHS)) {
            Object.defineProperty(target, property, {
                configurable: true,
                enumerable: true,
                get() { return this.sessionState[group][field] },
                set(value) { this.sessionState[group][field] = value }
            })
        }
        return target
    }

    Object.assign(app, { SESSION_STATE_PATHS, createSessionState, attachSessionState })
}(globalThis.ShootingGame))
