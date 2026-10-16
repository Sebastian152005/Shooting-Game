(function (app) {
    app.settings = app.createSettings(app.storage, app.config.audioDefaults)
    app.progression = { profile: level => app.domain.progressionProfile(level, app.config) }
    const Game = app.createGame({ config: app.config, assets: app.assets,
        storage: app.storage, settings: app.settings, rules: app.domain,
        platform: app.createBrowser(), randomFloat: Math.random })
    Object.assign(Game, app.createInput(Game), app.createAudio(Game), app.createHud(Game),
        app.createViewport(Game), app.createWaves(Game), app.createSpawning(Game), app.createMovement(Game),
        app.createAttacks(Game), app.createSimulation(Game), app.createScene(Game),
        app.createEntityRenderer(Game), app.createMedia(Game))
    if (app.createEnergySystem) Object.assign(Game, app.createEnergySystem(Game))
    if (app.createRewardSystem) Object.assign(Game, app.createRewardSystem(Game))
    if (app.createWorldEvents) Object.assign(Game, app.createWorldEvents(Game))
    if (app.createProgressionFeatureRenderer) Object.assign(Game, app.createProgressionFeatureRenderer(Game))
    if (app.createRewardDialog) Object.assign(Game, app.createRewardDialog(Game))

    // Each entity receives the same game session; cross-entity references are
    // resolved when playing, after every constructor has been registered.
    Game.entities = {}
    for (const [name, createEntity] of Object.entries(app.entityFactories)) {
        Game.entities[name] = createEntity(Game)
    }

    app.game = Game
    Game.init()
    app.bindAudioSettings(document.getElementById('audioSettings'), settings => {
        Game.updateAudioSettings(settings)
        if (!Game.paused) Game.audio.play().catch(() => {})
        if (Game.audioCtx?.state === 'suspended') Game.audioCtx.resume().catch(() => {})
    }, app.settings)
}(globalThis.ShootingGame))
