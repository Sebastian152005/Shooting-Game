(function (app) {
    app.domain = app.domain || {}
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

    app.domain.targetInFiringLane = function (origin, target, horizontalRange) {
        if (!origin || !target || horizontalRange < 0) return false
        const targetX = target.x + target.width / 2
        const targetY = target.y + target.height / 2
        return targetY > origin.y && Math.abs(targetX - origin.x) <= horizontalRange
    }

    app.domain.steerLateral = function (velocity, projectileX, targetX, dt, turnRate, maximumSpeed) {
        const desired = clamp((targetX - projectileX) / 42, -maximumSpeed, maximumSpeed)
        const change = clamp(desired - velocity, -turnRate * dt, turnRate * dt)
        return clamp(velocity + change, -maximumSpeed, maximumSpeed)
    }

    app.domain.predictHorizontalIntercept = function ({ targetX, targetVelocity, verticalDistance,
        projectileSpeed, minimumLead, maximumLead, minimumX, maximumX }) {
        const speedPerSecond = Math.max(0.001, Number(projectileSpeed) || 0) * 60
        const flightTime = Math.max(0, Number(verticalDistance) || 0) / speedPerSecond
        const leadTime = clamp(flightTime, minimumLead, maximumLead)
        return {
            x: clamp(targetX + (Number(targetVelocity) || 0) * leadTime, minimumX, maximumX),
            leadTime
        }
    }
}(globalThis.ShootingGame))
