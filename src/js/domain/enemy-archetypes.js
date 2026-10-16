(function (app) {
    app.domain = app.domain || {}
    const roles = Object.freeze({
        COMMON: 'pressure',
        AGGRESSOR: 'aggressor',
        MARKSMAN: 'marksman',
        CONTROLLER: 'controller'
    })

    app.domain.ENEMY_ROLES = roles
    app.domain.enemyRolePreference = function (profile, index) {
        if (profile.spread && index % 4 === 0) return roles.CONTROLLER
        if (profile.precision && index > 0 && index % 5 === 0) return roles.MARKSMAN
        if (profile.aggressors && index % 3 === 0) return roles.AGGRESSOR
        return roles.COMMON
    }
}(globalThis.ShootingGame))
