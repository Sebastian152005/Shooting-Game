(function (app) {
    app.storage = {
        readHighScore: function (fallback = 0) {
            try {
                const score = Number(localStorage.getItem(app.config.highScoreKey))
                return Number.isSafeInteger(score) && score >= 0 ? score : 0
            } catch (e) { return fallback }
        },
        writeHighScore: function (score) {
            try { localStorage.setItem(app.config.highScoreKey, score) } catch (e) {}
        },
        readProgress: function () {
            try {
                const stored = JSON.parse(localStorage.getItem(app.config.progressKey))
                return app.domain.migrateProgress(stored, app.config.rewards.maxLevel)
            } catch (e) {
                return app.domain.createDefaultProgress()
            }
        },
        writeProgress: function (progress) {
            try {
                const normalized = app.domain.migrateProgress(progress, app.config.rewards.maxLevel)
                localStorage.setItem(app.config.progressKey, JSON.stringify(normalized))
                return normalized
            } catch (e) {
                return app.domain.migrateProgress(progress, app.config.rewards.maxLevel)
            }
        },
        readAudioSettings: function () {
            try { return JSON.parse(localStorage.getItem(app.config.audioSettingsKey)) } catch (e) { return null }
        },
        writeAudioSettings: function (settings) {
            try { localStorage.setItem(app.config.audioSettingsKey, JSON.stringify(settings)) } catch (e) {}
        }
    }
}(globalThis.ShootingGame))
