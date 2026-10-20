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

    app.domain.variedEnemyRolePreference = function (profile, index, encounter = 0) {
        if (!profile.aggressors) return roles.COMMON
        const offset = Math.abs(index * 7 + profile.level * 5 + encounter * 3) % 12
        return app.domain.enemyRolePreference(profile, index + offset)
    }

    app.domain.enemyEntryAllowsSide = function (profile) {
        return Boolean(profile?.aggressors)
    }

    app.domain.enemyEntryRequiresSpecialist = function (profile, entryKind) {
        return entryKind === 'side' && app.domain.enemyEntryAllowsSide(profile)
    }

    app.domain.enemyEntryKindsForRole = function (profile, role) {
        // Entry direction is part of the archetype language: aggressors flank
        // from a side, while every other UFO joins the formation from above.
        return role === roles.AGGRESSOR && app.domain.enemyEntryAllowsSide(profile)
            ? Object.freeze(['side']) : Object.freeze(['top'])
    }

    app.domain.enemyEntryDuration = function (entryKind, index, baseDuration,
        fastMultiplier, smoothMultiplier) {
        const base = Math.max(0.001, Number(baseDuration) || 0.001)
        if (entryKind !== 'side') return base
        const multiplier = Math.abs(Number(index) || 0) % 2 === 1
            ? fastMultiplier : smoothMultiplier
        return base * Math.max(0.1, Number(multiplier) || 1)
    }

    app.domain.enemyEntryRolePreference = function (profile, preferredRole, entryKind) {
        // A lateral entrance communicates an aggressive incursion. Keep its
        // behaviour and visual identity aligned once that archetype is unlocked.
        if (app.domain.enemyEntryRequiresSpecialist(profile, entryKind)) return roles.AGGRESSOR
        return preferredRole
    }

    app.domain.canAssignEnemyRole = function (preferredRole, activeRoles, capacity,
        maxSpecialistsPerRole, minimumCommonEnemies) {
        if (preferredRole === roles.COMMON) return true
        const rolesInPlay = Array.isArray(activeRoles) ? activeRoles : []
        const specialistLimit = Math.max(0, capacity - minimumCommonEnemies)
        const specialists = rolesInPlay.filter(role => role && role !== roles.COMMON)
        return specialists.filter(role => role === preferredRole).length < maxSpecialistsPerRole
            && specialists.length < specialistLimit
    }

    app.domain.canUseEnemyEntry = function (profile, entryKind, activeRoles, capacity,
        maxSpecialistsPerRole, minimumCommonEnemies) {
        if (!app.domain.enemyEntryRequiresSpecialist(profile, entryKind)) return entryKind === 'top'
        return app.domain.canAssignEnemyRole(roles.AGGRESSOR, activeRoles, capacity,
            maxSpecialistsPerRole, minimumCommonEnemies)
    }

    app.domain.enemyCadenceTrait = function (index, variation = 0) {
        const spread = Math.max(0, Math.min(0.25, Number(variation) || 0))
        const phase = ((Math.max(0, Number(index) || 0) * 0.61803398875) % 1)
        return 1 - spread + phase * spread * 2
    }

    app.domain.enemyMovementTrait = function (index, variation = 0) {
        const spread = Math.max(0, Math.min(0.25, Number(variation) || 0))
        const phase = ((Math.max(0, Number(index) || 0) * 0.754877666 + 0.31) % 1)
        return 1 - spread + phase * spread * 2
    }

    app.domain.enemyArchetypeSignature = function (role) {
        const signatures = {
            [roles.AGGRESSOR]: {
                entrySwayScale: 1, entryDurationScale: 0.92,
                movementScale: 1.16, bankScale: 1.25
            },
            [roles.MARKSMAN]: {
                entrySwayScale: 0.28, entryDurationScale: 1.12,
                movementScale: 0.9, bankScale: 0.68
            },
            [roles.CONTROLLER]: {
                entrySwayScale: 1.22, entryDurationScale: 1.16,
                movementScale: 0.84, bankScale: 0.78
            },
            [roles.COMMON]: {
                entrySwayScale: 0.68, entryDurationScale: 1,
                movementScale: 1, bankScale: 0.92
            }
        }
        return Object.freeze({ ...(signatures[role] || signatures[roles.COMMON]) })
    }
}(globalThis.ShootingGame))
