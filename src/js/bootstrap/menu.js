(function (app) {
    app.settings = app.createSettings(app.storage, app.config.audioDefaults)
    const record = document.getElementById('highScore')
    const refreshRecord = () => { record.textContent = app.storage.readHighScore().toLocaleString('es-PE') }
    refreshRecord()
    // Back navigation may restore the menu from the browser's page cache.
    window.addEventListener('pageshow', refreshRecord)
    window.addEventListener('storage', event => {
        if (event.key === app.config.highScoreKey || event.key === null) refreshRecord()
    })
    app.bindAudioSettings(document.getElementById('audioSettings'), undefined, app.settings)

    let navigating = false
    document.getElementById('btnPlay').addEventListener('click', function (event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return
        event.preventDefault()
        if (navigating) return
        navigating = true
        document.body.classList.add('fade-out')
        const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0 : 600
        setTimeout(function () { window.location.href = document.getElementById('btnPlay').href }, delay)
    })
    window.addEventListener('pageshow', () => {
        navigating = false
        document.body.classList.remove('fade-out')
    })
}(globalThis.ShootingGame))
