(function (app) {
    app.domain = app.domain || {}
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

    app.domain.targetAwareness = function (origin, target, viewportWidth, viewportHeight) {
        if (!origin || !target || viewportWidth <= 0 || viewportHeight <= 0) {
            return Object.freeze({ detected: false, confidence: 0 })
        }
        const targetX = target.x + target.width / 2
        const targetY = target.y + target.height / 2
        if (targetY <= origin.y) return Object.freeze({ detected: false, confidence: 0 })
        const horizontalDistance = Math.abs(targetX - origin.x) / viewportWidth
        const verticalDistance = Math.max(0, targetY - origin.y) / viewportHeight
        const confidence = clamp(1 - horizontalDistance * 0.65 - verticalDistance * 0.2, 0, 1)
        return Object.freeze({ detected: confidence > 0, confidence })
    }

    app.domain.straightShotOpportunity = function (snapshot = {}) {
        const projectileSpeed = Math.max(0.001, Number(snapshot.projectileSpeed) || 0.001) * 60
        const flightTime = Math.max(0, Number(snapshot.verticalDistance) || 0) / projectileSpeed
        const stability = clamp(Number(snapshot.stability) || 0, 0, 1)
        const observations = Math.max(0, Number(snapshot.observations) || 0)
        const targetVelocity = Number(snapshot.targetVelocity) || 0
        const moving = Math.abs(targetVelocity) > 20
        const reliableMotion = !moving || (observations >= 2 && stability >= 0.32)
        // A short prediction looks intentional on screen. Full flight-time lead
        // made straight lasers appear to fire into empty space.
        const maximumLead = Math.max(0.1, Number(snapshot.maximumLead) || 0.32)
        const predictionTime = Math.min(flightTime, maximumLead)
        const leadFactor = 0.55 + stability * 0.25
        const viewportWidth = Math.max(1, Number(snapshot.viewportWidth) || 1)
        const targetWidth = Math.max(1, Number(snapshot.targetWidth) || 1)
        const predictedX = clamp((Number(snapshot.targetX) || 0)
            + targetVelocity * predictionTime * leadFactor,
        targetWidth / 2, viewportWidth - targetWidth / 2)
        const tolerance = Math.max(targetWidth * 0.75,
            viewportWidth * Math.max(0.01, Number(snapshot.toleranceRatio) || 0.045))
        const engagement = Math.max(targetWidth * 1.35,
            viewportWidth * Math.max(0.04, Number(snapshot.engagementRatio) || 0.1))
        const originX = Number(snapshot.originX) || 0
        const currentDistance = Math.abs((Number(snapshot.targetX) || 0) - originX)
        return Object.freeze({
            canFire: reliableMotion && currentDistance <= engagement
                && Math.abs(predictedX - originX) <= tolerance,
            predictedX, flightTime, predictionTime, tolerance, engagement,
            reliableMotion
        })
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
