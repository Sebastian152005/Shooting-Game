(function (app) {
    app.domain = app.domain || {}

    const states = Object.freeze({
        ENTERING: 'entering',
        PATROL: 'patrol',
        ACQUIRING: 'acquiring',
        WARNING: 'warning',
        RECOVERY: 'recovery'
    })

    const intents = Object.freeze({
        PATROL: 'patrol',
        PRESS: 'press',
        FLANK: 'flank',
        POSITION: 'position',
        CONTROL: 'control',
        RECOVER: 'recover'
    })

    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))

    const snapshot = (state, acquisitionRemaining = 0, action = null) => ({
        state, acquisitionRemaining, action
    })

    app.domain.ENEMY_AI_STATES = states
    app.domain.ENEMY_INTENTS = intents
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
        const previousVelocity = Number(previous?.horizontalVelocity) || 0
        const velocityRange = Math.max(60, Math.abs(previousVelocity), Math.abs(velocity))
        const consistency = 1 - Math.min(1, Math.abs(velocity - previousVelocity) / velocityRange)
        const stability = previous
            ? clamp((Number(previous.stability) || 0.5) * 0.7 + consistency * 0.3, 0, 1)
            : 0.5
        return Object.freeze({
            x: observation.x,
            y: observation.y,
            horizontalVelocity: previous
                ? previousVelocity * 0.35 + velocity * 0.65
                : velocity,
            stability,
            observations: Math.min(12, (Number(previous?.observations) || 0) + 1)
        })
    }

    app.domain.combatDirective = function (intensity = {}) {
        if (intensity.adaptation === 'relief' || intensity.phase === 'recovery') return intents.RECOVER
        if (intensity.phase === 'assault') return intents.PRESS
        return intents.POSITION
    }

    app.domain.decideEnemyIntent = function (snapshot = {}) {
        const role = snapshot.role || 'pressure'
        const directive = snapshot.directive || intents.PATROL
        const width = Math.max(1, Number(snapshot.viewportWidth) || 1)
        const halfShip = Math.max(0, Number(snapshot.enemyWidth) || 0) / 2
        const minimumX = halfShip
        const maximumX = Math.max(minimumX, width - halfShip)
        const originX = clamp(Number(snapshot.originX) || minimumX, minimumX, maximumX)
        const observed = Number.isFinite(snapshot.targetX)
        const targetVelocity = Number(snapshot.targetVelocity) || 0
        const side = Number(snapshot.index) % 2 === 0 ? -1 : 1
        let mode = intents.PATROL
        let desiredX = null
        let movementMultiplier = 1
        const readiness = Number(snapshot.readiness) || 0
        const positioningReadiness = Number(snapshot.positioningReadiness) || 0.58
        const readyForSpecialistPosition = readiness >= positioningReadiness
            || snapshot.aiState === states.ACQUIRING

        if ((directive === intents.RECOVER || snapshot.aiState === states.RECOVERY)
            && role !== 'pressure') {
            mode = intents.RECOVER
            desiredX = width * (side < 0 ? 0.22 : 0.78)
            movementMultiplier = 1.08
        } else if (directive === intents.RECOVER) {
            // Common ships preserve their independent patrol while their firing
            // cadence slows; they do not all collapse into shared retreat lanes.
            mode = intents.PATROL
            desiredX = null
        } else if (!observed) {
            // Without a radar observation or brief memory, keep the natural
            // patrol. A tactical director must not grant omniscient movement.
            mode = intents.PATROL
            desiredX = null
        } else if (role !== 'pressure' && !readyForSpecialistPosition) {
            mode = intents.PATROL
            desiredX = null
        } else if (role === 'aggressor') {
            mode = snapshot.tracking ? intents.FLANK : intents.PRESS
            desiredX = snapshot.tracking
                ? snapshot.targetX + side * Math.max(50, Number(snapshot.flankOffset) || 90)
                : snapshot.targetX + targetVelocity * 0.16
            movementMultiplier = 1.12
        } else if (role === 'marksman') {
            mode = intents.POSITION
            const movementSide = Math.abs(targetVelocity) > 1 ? Math.sign(targetVelocity) : side
            desiredX = snapshot.targetX - movementSide * Math.max(45, Number(snapshot.marksmanOffset) || 75)
        } else if (role === 'controller') {
            mode = intents.CONTROL
            desiredX = snapshot.targetX + targetVelocity * Math.max(0, Number(snapshot.controllerLead) || 0.2)
                + side * Math.max(30, Number(snapshot.controllerOffset) || 55)
        } else if (readiness >= (Number(snapshot.readinessThreshold) || 0.68)) {
            // Commons never collapse into one aiming lane. They preserve their
            // patrol and take independent shots only when their natural route
            // creates a credible short-range intercept.
            mode = intents.PRESS
            desiredX = null
            movementMultiplier = Math.max(1, Number(snapshot.pressMovementMultiplier) || 1.2)
        }

        if (desiredX === null) {
            return Object.freeze({ mode, desiredX: null, movingLeft: Boolean(snapshot.movingLeft), movementMultiplier })
        }
        desiredX = clamp(desiredX, minimumX, maximumX)
        const deadzone = Math.max(4, Number(snapshot.deadzone) || 12)
        if (Math.abs(desiredX - originX) <= deadzone) {
            // Reaching a tactical lane completes the steering request; it must
            // never turn into an invisible parking order. The ship keeps its
            // current patrol direction and can still acquire/fire while crossing.
            return Object.freeze({
                mode, desiredX: null,
                movingLeft: Boolean(snapshot.movingLeft), movementMultiplier
            })
        }
        return Object.freeze({
            mode, desiredX,
            movingLeft: desiredX < originX, movementMultiplier
        })
    }

    app.domain.hasSpecialAttackConflict = function (candidate, activeAttacks = [], minimumSeparation = 0) {
        if (!candidate?.kind) return false
        return activeAttacks.some(attack => attack && attack.kind === candidate.kind
            && Math.abs((Number(attack.x) || 0) - (Number(candidate.x) || 0)) < minimumSeparation)
    }

    app.domain.enemyTrafficPlan = function (snapshot = {}) {
        const actorIndex = Number(snapshot.actorIndex) || 0
        const blockerIndex = Number(snapshot.blockerIndex) || 0
        const actorCenter = Number(snapshot.actorCenter) || 0
        const blockerCenter = Number(snapshot.blockerCenter) || 0
        const maximumX = Math.max(0, Number(snapshot.maximumX) || 0)
        const actorX = clamp(Number(snapshot.actorX) || 0, 0, maximumX)
        let horizontalDirection = actorCenter <= blockerCenter ? -1 : 1
        const clearance = Math.max(1, Number(snapshot.clearance) || 1)
        if (horizontalDirection < 0 && actorX < clearance) horizontalDirection = 1
        if (horizontalDirection > 0 && maximumX - actorX < clearance) horizontalDirection = -1
        return Object.freeze({
            yields: actorIndex > blockerIndex,
            horizontalDirection,
            verticalDirection: actorIndex % 2 === 0 ? -1 : 1
        })
    }
}(globalThis.ShootingGame))
