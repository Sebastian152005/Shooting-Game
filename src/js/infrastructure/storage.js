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
        readAudioSettings: function () {
            try { return JSON.parse(localStorage.getItem(app.config.audioSettingsKey)) } catch (e) { return null }
        },
        writeAudioSettings: function (settings) {
            try { localStorage.setItem(app.config.audioSettingsKey, JSON.stringify(settings)) } catch (e) {}
        }
    }
}(globalThis.ShootingGame))
