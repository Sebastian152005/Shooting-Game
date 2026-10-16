(function (app) {
    app.domain = app.domain || {}

    function clampEnergy(value, minimum = 0, maximum = 100) {
        const numeric = Number(value)
        return Math.max(minimum, Math.min(maximum, Number.isFinite(numeric) ? numeric : minimum))
    }

    function isInsidePulse(origin, target, radius) {
        if (!origin || !target || !Number.isFinite(radius) || radius < 0) return false
        const targetX = Number(target.x) + Number(target.width || 0) / 2
        const targetY = Number(target.y) + Number(target.height || 0) / 2
        const dx = targetX - Number(origin.x)
        const dy = targetY - Number(origin.y)
        return Number.isFinite(dx) && Number.isFinite(dy) && dx * dx + dy * dy <= radius * radius
    }

    Object.assign(app.domain, { clampEnergy, isInsidePulse })
}(globalThis.ShootingGame))
