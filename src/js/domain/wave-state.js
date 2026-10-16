(function (app) {
    app.domain = app.domain || {}

    const WAVE_STAGES = Object.freeze({
        INTRO: 'intro',
        WAVE: 'wave',
        BOSS_PENDING: 'boss-pending',
        BOSS: 'boss',
        RECOVERY: 'recovery'
    })
    const WAVE_EVENTS = Object.freeze({
        INTRO_COMPLETED: 'intro-completed',
        BOSS_REQUESTED: 'boss-requested',
        BOSS_STARTED: 'boss-started',
        BOSS_DEFEATED: 'boss-defeated',
        RECOVERY_COMPLETED: 'recovery-completed'
    })
    const transitions = Object.freeze({
        [WAVE_STAGES.INTRO]: Object.freeze({
            [WAVE_EVENTS.INTRO_COMPLETED]: WAVE_STAGES.WAVE
        }),
        [WAVE_STAGES.WAVE]: Object.freeze({
            [WAVE_EVENTS.BOSS_REQUESTED]: WAVE_STAGES.BOSS_PENDING
        }),
        [WAVE_STAGES.BOSS_PENDING]: Object.freeze({
            [WAVE_EVENTS.BOSS_STARTED]: WAVE_STAGES.BOSS
        }),
        [WAVE_STAGES.BOSS]: Object.freeze({
            [WAVE_EVENTS.BOSS_DEFEATED]: WAVE_STAGES.RECOVERY
        }),
        [WAVE_STAGES.RECOVERY]: Object.freeze({
            [WAVE_EVENTS.RECOVERY_COMPLETED]: WAVE_STAGES.WAVE
        })
    })

    function transitionWaveStage(current, event) {
        const next = transitions[current]?.[event]
        if (!next) throw Error(`Invalid wave transition: ${current} + ${event}`)
        return next
    }

    Object.assign(app.domain, { WAVE_EVENTS, WAVE_STAGES, transitionWaveStage })
}(globalThis.ShootingGame))
