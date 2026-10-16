(function (app) {
    app.domain = app.domain || {}

    const states = Object.freeze({
        ENTERING: 'entering',
        PATROL: 'patrol',
        ACQUIRING: 'acquiring',
        WARNING: 'warning',
        RECOVERY: 'recovery'
    })

    const snapshot = (state, acquisitionRemaining = 0, action = null) => ({
        state, acquisitionRemaining, action
    })

    app.domain.ENEMY_AI_STATES = states
    app.domain.advanceEnemyAI = function (current, input) {
        const state = current?.state || states.ENTERING
        const remaining = Math.max(0, current?.acquisitionRemaining || 0)
        if (input.entering) return snapshot(states.ENTERING)
        if (state === states.ENTERING) return snapshot(states.PATROL)
        if (state === states.WARNING) return snapshot(states.WARNING, remaining)
        if (state === states.RECOVERY) {
            return input.ready ? snapshot(states.PATROL) : snapshot(states.RECOVERY)
        }
        if (state === states.PATROL) {
            if (!input.ready || !input.detected) return snapshot(states.PATROL)
            const duration = Math.max(0, input.acquisitionDuration || 0)
            return duration === 0
                ? snapshot(states.PATROL, 0, 'fire')
                : snapshot(states.ACQUIRING, duration)
        }
        if (state === states.ACQUIRING) {
            if (!input.detected) return snapshot(states.PATROL, 0, 'cancel')
            const next = Math.max(0, remaining - Math.max(0, input.dt || 0))
            return snapshot(states.ACQUIRING, next, next === 0 ? 'fire' : null)
        }
        return snapshot(states.PATROL)
    }

    app.domain.rememberEnemyTarget = function (previous, observation) {
        const velocity = Number.isFinite(observation.horizontalVelocity)
            ? observation.horizontalVelocity : 0
        return Object.freeze({
            x: observation.x,
            y: observation.y,
            horizontalVelocity: previous
                ? previous.horizontalVelocity * 0.35 + velocity * 0.65
                : velocity
        })
    }
}(globalThis.ShootingGame))
