const assert = require('node:assert/strict')
const { test } = require('node:test')
const { setup } = require('./support/game-fixture.cjs')

test('game starts even when the background video is not ready', () => {
    const { Game, frame } = setup()
    frame()
    assert.ok(Game.elapsedTime > 0)
    assert.equal(Game.video.readyState, 0)
})

test('pause, resume and restart maintain a single animation loop and binding', () => {
    const { Game, frames, listeners, frame } = setup()
    Game.pause()
    assert.equal(frames.size, 0)
    assert.equal(Game.audio.paused, true)
    Game.unPause()
    Game.unPause()
    frame()
    Game.init()
    assert.equal(frames.size, 1)
    for (const callbacks of listeners.values()) assert.equal(callbacks.length, 1)
})

test('continuous enemy respawns use game time and are discarded on restart', () => {
    const { Game, frame } = setup()
    Object.values(Game.enemies)[0].die()
    assert.equal(Object.keys(Game.enemies).length, 5)
    assert.equal(Game.pendingSpawns.length, 1)
    Game.pause()
    assert.equal(Game.pendingSpawns[0], 2)
    Game.unPause()
    frame()
    assert.ok(Game.pendingSpawns[0] < 2)
    Game.advanceSpawnsForTest(8)
    assert.equal(Object.keys(Game.enemies).length, 6)
    Object.values(Game.enemies)[0].die()
    Game.init()
    assert.equal(Game.pendingSpawns.length, 6)
    assert.equal(Object.keys(Game.enemies).length, 0)
    assert.equal(Game.waveStage, 'intro')
})

test('boss cancels reserved normal spawns without leaking enemy slots', () => {
    const { Game, Boss } = setup()
    Object.values(Game.enemies)[0].die()
    assert.equal(Game.pendingSpawns.length, 1)
    Game.spawnBossForTest()
    Game.updateSpawns(0.1)
    assert.equal(Game.pendingSpawns.length, 0)
    assert.equal(Game.enemiesAlive, Object.keys(Game.enemies).length)
})

test('single and triple bullets delete their own collection entries', () => {
    const { Game } = setup()
    for (const tripleShot of [0, 6]) {
        Game.player.tripleShot = tripleShot
        Game.player.shoot()
        assert.equal(Object.keys(Game.bullets).length, tripleShot ? 3 : 1)
        for (const [key, bullet] of Object.entries(Game.bullets)) {
            assert.equal(String(bullet.index), key)
            bullet.y = -100
            bullet.update()
        }
        assert.equal(Object.keys(Game.bullets).length, 0)
    }
})

test('fifth hit ends the game and no new animation is scheduled', () => {
    const { Game, frames } = setup()
    for (let i = 0; i < 4; i++) Game.player.die()
    assert.equal(Game.isGameOver, false)
    Game.player.die()
    assert.equal(Game.life, 5)
    assert.equal(Game.isGameOver, true)
    assert.equal(frames.size, 0)
    Game.unPause()
    assert.equal(frames.size, 0)
})

test('keyboard cannot fire or move while paused; losing focus clears held keys', () => {
    const { Game, listeners } = setup()
    Game.buttonDown({ key: 'a' })
    Game.buttonDown({ key: ' ', preventDefault() {} })
    assert.equal(Game.shooting, true)
    listeners.get('blur')[0]()
    assert.equal(Game.player.movingLeft, false)
    assert.equal(Game.shooting, false)
    Game.buttonDown({ key: 'd' })
    Game.buttonDown({ key: ' ', preventDefault() {} })
    assert.equal(Game.player.movingRight, false)
    assert.equal(Object.keys(Game.bullets).length, 0)
})

test('storage denial does not prevent starting, ending or restarting a game', () => {
    const { Game } = setup({ blockedStorage: true })
    Game.score = 100
    Game.gameOver()
    assert.equal(Game.highScore, 100)
    Game.init()
    assert.equal(Game.highScore, 100)
})

test('invalid records are ignored', () => {
    for (const storedScore of ['NaN', '-10', '12oops', '1.5']) {
        assert.equal(setup({ storedScore }).Game.highScore, 0)
    }
    assert.equal(setup({ storedScore: '123' }).Game.highScore, 123)
})

test('player stays inside the canvas at high movement speeds', () => {
    const { Game } = setup()
    Game.player.speed = 500
    Game.player.x = 1
    Game.player.movingLeft = true
    Game.player.update()
    assert.equal(Game.player.x, 0)
    Game.player.movingLeft = false
    Game.player.movingRight = true
    Game.player.x = Game.c.width - Game.player.width - 1
    Game.player.update()
    assert.equal(Game.player.x, Game.view.width - Game.player.width)
})

test('enemy hits award points and reserve a replacement', () => {
    const { Game, Bullet } = setup()
    const enemy = Object.values(Game.enemies)[0]
    const bullet = new Bullet(enemy.x + 20, 0)
    bullet.y = enemy.y + 10
    enemy.update()
    assert.equal(enemy.dead, true)
    assert.ok(Game.score > 0)
    assert.equal(Game.bullets[bullet.index], undefined)
    assert.equal(Game.pendingSpawns.length, 1)
    assert.ok(Object.keys(Game.particles).length > 0)
})

test('extracted boss handles the final hit and schedules the next wave', () => {
    const { Game, Boss, Bullet } = setup()
    const boss = Game.spawnBossForTest()
    boss.entering = false
    boss.y = 15
    boss.hp = 1
    Game.enemies = {}
    Game.enemiesAlive = 0
    const bullet = new Bullet(boss.x + 40, 0)
    bullet.y = boss.y + 10
    boss.update()
    assert.equal(Game.boss, null)
    assert.equal(Game.bossActive, false)
    assert.equal(Game.pendingSpawns.length, 0, 'the next group is not queued until recovery ends')
    assert.equal(Game.waveStage, 'recovery')
    assert.ok(Game.score >= 300)
})

test('all four extracted power-ups can activate their effects', () => {
    for (const type of ['rapidfire', 'shield', 'triple', 'bomb']) {
        const { Game, Boss } = setup()
        const powerUp = new Game.entities.PowerUp(100, 100)
        powerUp.type = type
        const boss = type === 'bomb' ? Game.spawnBossForTest() : null
        powerUp.activate()
        if (type === 'rapidfire') assert.equal(Game.player.rapidFire, 6)
        if (type === 'shield') assert.equal(Game.player.shield, 5)
        if (type === 'triple') assert.equal(Game.player.tripleShot, 6)
        if (type === 'bomb') {
            assert.equal(Game.player.bombFlash, 1)
            assert.equal(Object.keys(Game.enemies).length, 0)
            assert.equal(boss.hp, Math.ceil(boss.maxHp / 2))
        }
        assert.ok(Object.keys(Game.floatingTexts).length > 0)
    }
})

test('sprite instances are shared across enemies, bosses and game restarts', () => {
    const { Game, Enemy, images, assets, drawnImages } = setup({ imageStatus: 'loaded' })
    const playerImage = assets.get(Game.player.sprite)
    const scoutImage = assets.get(Object.values(Game.enemies)[0].sprite)
    const initialImageCount = images.length
    assert.ok(initialImageCount >= 5)
    for (let i = 0; i < 20; i++) {
        new Enemy().draw()
        assert.equal(drawnImages.at(-1), scoutImage)
    }
    Game.spawnBossForTest().draw()
    assert.equal(drawnImages.at(-1), assets.get('enemy'))
    Game.init()
    assert.equal(assets.get(Game.player.sprite), playerImage)
    assert.equal(images.length, initialImageCount)
})

test('missing and pending sprites use visible fallbacks without stopping the game', () => {
    for (const imageStatus of ['loading', 'failed']) {
        const { Game, frame, drawnImages, fallbackFills } = setup({ imageStatus })
        frame()
        assert.ok(Game.elapsedTime > 0)
        assert.equal(drawnImages.length, 0)
        assert.ok(fallbackFills() >= 12, 'player, six enemies and five lives remain visible')
    }
})

test('sprites switch from fallback to normal drawing when loading finishes', () => {
    const { frame, images, drawnImages } = setup()
    frame()
    assert.equal(drawnImages.length, 0)
    for (const image of images) { image.complete = true; image.naturalWidth = 100 }
    frame(32)
    assert.ok(drawnImages.length >= 12)
})

test('HD canvas fills the viewport with equally scaled axes and density-aware pixels', () => {
    const { Game, transforms } = setup({ width: 1920, height: 1080, pixelRatio: 2 })
    assert.equal(Game.c.width, 3840)
    assert.equal(Game.c.height, 2160)
    assert.equal(Game.view.width, 960)
    assert.equal(Game.view.height, 540)
    assert.deepEqual(transforms.at(-1), [4, 0, 0, 4, 0, 0])
    assert.equal(Game.player.y, 470)
    assert.equal(Game.ctx.imageSmoothingQuality, 'high')
})

test('resizing adjusts the playable area without restarting or duplicating the loop', () => {
    const { Game, resize, frames } = setup()
    Game.score = 75
    const sprite = Game.player.sprite
    resize(2560, 1080, 1)
    assert.ok(Math.abs(Game.view.width - 1280) < 0.000001)
    assert.equal(Game.c.width, 2560)
    assert.equal(Game.player.sprite, sprite)
    assert.equal(Game.score, 75)
    assert.equal(frames.size, 1)
    resize(360, 780, 3)
    assert.equal(Game.c.width, 720, 'pixel density is capped at 2 for performance')
    assert.equal(Game.c.height, 1560)
    assert.ok(Math.abs(Game.view.width - 360) < 0.000001)
    assert.ok(Game.player.x >= 0 && Game.player.x + Game.player.width <= Game.view.width)
    assert.equal(Game.player.y, Game.view.height - Game.player.height)
})

test('resizing paused and finished scenes preserves state and draws the overlay again', () => {
    const { Game, resize, frames } = setup()
    const particle = new Game.entities.Particle(100, 100)
    Game.pause()
    const elapsed = Game.elapsedTime
    const life = particle.life
    resize(1920, 1080)
    assert.equal(Game.paused, true)
    assert.equal(Game.elapsedTime, elapsed)
    assert.equal(particle.life, life)
    assert.equal(frames.size, 0)
    Game.score = 100
    Game.gameOver()
    resize(1280, 720)
    assert.equal(Game.isGameOver, true)
    assert.equal(Game.isNewRecord, true)
    assert.equal(Game.score, 100)
    assert.equal(frames.size, 0)
})

test('video covers the screen by cropping instead of stretching', () => {
    const { Game, videoDraws } = setup({ width: 1920, height: 1080 })
    Game.video.readyState = 2
    Game.video.videoWidth = 900
    Game.video.videoHeight = 540
    Game.drawVideo()
    const [x, y, width, height, dx, dy, dw, dh] = videoDraws.at(-1)
    assert.equal(x, 0)
    assert.ok(y > 0)
    assert.equal(width, 900)
    assert.ok(Math.abs(width / height - dw / dh) < 0.000001)
    assert.deepEqual([dx, dy, dw, dh], [0, 0, Game.view.width, Game.view.height])
})

test('audio panel changes music and effects separately and retains levels when muted', () => {
    const { Game, controls, app } = setup({ audioPanel: true, synthAudio: true })
    const music = controls.get('[data-music-volume]')
    const effects = controls.get('[data-effects-volume]')
    const mute = controls.get('[data-mute]')
    music.value = '80'
    music.dispatch('input')
    assert.equal(Game.audio.volume, 0.8)
    assert.equal(Game.sfxExplosion.volume, 0.5)
    effects.value = '20'
    effects.dispatch('input')
    assert.equal(Game.sfxExplosion.volume, 0.2)
    assert.ok(Math.abs(Game.sfxLaser.volume - 0.16) < 0.00001)
    assert.equal(Game.effectsGain.gain.value, 0.2)
    mute.dispatch('click')
    for (const audio of [Game.audio, Game.sfxLaser, Game.sfxExplosion]) assert.equal(audio.muted, true)
    assert.equal(Game.effectsGain.gain.value, 0)
    assert.equal(mute.attributes['aria-pressed'], 'true')
    assert.equal(music.value, 80)
    mute.dispatch('click')
    assert.equal(Game.audio.volume, 0.8)
    assert.equal(Game.audio.muted, false)
    assert.equal(Game.effectsGain.gain.value, 0.2)
    assert.equal(app.settings.get().effects, 0.2)
})

test('synthesized sounds route through the effects volume and mute channel', () => {
    const { Game } = setup({ synthAudio: true })
    Game.playLevelUpSound()
    Game.playTripleShotSound()
    Game.playHitSound()
    Game.playBombSound()
    Game.playEnergyPickupSound()
    Game.playPulseActivationSound()
    Game.playOrbitalWarningSound()
    Game.playPulseImpactSound({ projectiles: 4, meteors: 1 })
    for (const type of ['rapidfire', 'shield', 'triple', 'bomb']) Game.playPowerUpSound(type)
    const directOutputs = Game.audioCtx.nodes.filter(node => node.connections.includes(Game.audioCtx.destination))
    assert.deepEqual(directOutputs, [Game.effectsGain])
    assert.ok(Game.audioCtx.nodes.filter(node => node.connections.includes(Game.effectsGain)).length >= 10)
})

test('menu settings persist into a new game session and survive restarting', () => {
    const storageValues = new Map()
    const menu = setup({ page: 'index.html', audioPanel: true, storageValues })
    menu.controls.get('[data-music-volume]').value = '65'
    menu.controls.get('[data-music-volume]').dispatch('input')
    menu.controls.get('[data-mute]').dispatch('click')
    const { Game } = setup({ storageValues })
    assert.equal(Game.audio.volume, 0.65)
    assert.equal(Game.audio.muted, true)
    Game.init()
    assert.equal(Game.audio.volume, 0.65)
    assert.equal(Game.sfxLaser.muted, true)
})

test('invalid audio storage is normalized and storage denial keeps settings in memory', () => {
    const storageValues = new Map([['warInSpaceAudio', '{broken']])
    assert.equal(setup({ storageValues }).Game.audio.volume, 0.3)
    storageValues.set('warInSpaceAudio', JSON.stringify({ music: 2, effects: -1, muted: 'yes' }))
    const normalized = setup({ storageValues })
    assert.equal(normalized.Game.audio.volume, 1)
    assert.equal(normalized.Game.sfxExplosion.volume, 0)
    assert.equal(normalized.Game.audio.muted, false)
    const { Game, app } = setup({ blockedStorage: true })
    Game.updateAudioSettings(app.settings.update({ music: 0.1, muted: true }))
    Game.init()
    assert.equal(Game.audio.volume, 0.1)
    assert.equal(Game.audio.muted, true)
})

test('slider keyboard events do not move or shoot the ship', () => {
    const { Game, controls } = setup({ audioPanel: true })
    Game.shooting = true
    Game.player.movingLeft = true
    Game.buttonDown({ key: 'ArrowRight', target: controls.get('[data-effects-volume]'),
        preventDefault() { assert.fail('range keyboard controls must retain their default behavior') } })
    assert.equal(Game.shooting, false)
    assert.equal(Game.player.movingLeft, false)
    assert.equal(Game.player.movingRight, false)
})

test('menu displays the record and refreshes it on back navigation', () => {
    const storageValues = new Map([['warInSpaceHS', '1234']])
    const { record, listeners } = setup({ page: 'index.html', storageValues })
    assert.equal(record.textContent, (1234).toLocaleString('es-PE'))
    storageValues.set('warInSpaceHS', '4567')
    listeners.get('pageshow')[0]()
    assert.equal(record.textContent, (4567).toLocaleString('es-PE'))
})

test('pause resumes only through Continue and prevents dismissal with Escape', () => {
    const { Game, pauseMenu, resume, frames } = setup()
    Game.pause()
    assert.equal(pauseMenu.open, true)
    Game.clicked()
    Game.buttonDown({ key: 'p' })
    Game.buttonDown({ key: 'Escape' })
    let cancelled = false
    pauseMenu.dispatch('cancel', { preventDefault() { cancelled = true } })
    assert.equal(cancelled, true)
    assert.equal(Game.paused, true)
    assert.equal(frames.size, 0)
    resume.dispatch('click')
    assert.equal(Game.paused, false)
    assert.equal(pauseMenu.open, false)
    assert.equal(frames.size, 1)
    assert.equal(Game.player.invincibleTimer, 1)
})

test('resizing preserves the pause dialog and restarting or game over closes it', () => {
    const { Game, pauseMenu, resize } = setup()
    Game.pause()
    resize(1280, 720)
    assert.equal(pauseMenu.open, true)
    Game.init()
    assert.equal(pauseMenu.open, false)
    Game.pause()
    Game.gameOver()
    assert.equal(pauseMenu.open, false)
})

test('progressive levels unlock patterns for future arrivals without changing surviving enemies', () => {
    const { Game, Enemy } = setup()
    const survivor = Object.values(Game.enemies)[0]
    const profile = survivor.profile
    const maxY = survivor.maxY
    assert.ok(Object.values(Game.enemies).every(enemy => enemy.pattern === 'patrol'))
    Game.updateProgression(20)
    assert.equal(Game.difficulty, 2)
    assert.ok(Game.waveProfile.patterns.includes('sine'))
    assert.ok(Object.values(Game.enemies).every(enemy => enemy.pattern === 'patrol'))
    Game.updateProgression(20)
    assert.equal(Game.difficulty, 3)
    assert.ok(Game.waveProfile.patterns.includes('zigzag'))
    Game.updateProgression(20)
    assert.equal(Game.difficulty, 4)
    assert.ok(Game.waveProfile.patterns.includes('diver'))
    assert.equal(Game.waveStage, 'wave')
    assert.equal(Game.enemies[survivor.index], survivor)
    assert.equal(survivor.profile, profile)
    assert.equal(survivor.maxY, maxY)
    Game.enemyIndex = 7
    const arrival = new Enemy()
    assert.equal(arrival.profile.level, 4)
    assert.equal(arrival.pattern, 'diver')
})

test('boss waits for surviving UFOs, cancels reinforcements and freezes progression until they are defeated', () => {
    const { Game } = setup()
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    Game.score = 50
    Game.fireEnemyVolley(100, 100, 3, 'lime', [0])
    Object.values(Game.enemies)[0].die()
    const score = Game.score
    Game.increaseDifficulty()
    assert.equal(Game.difficulty, 5)
    assert.equal(Game.waveStage, 'boss-pending')
    assert.equal(Object.keys(Game.enemies).length, 5)
    assert.equal(Game.pendingSpawns.length, 0)
    assert.equal(Object.keys(Game.enemyBullets).length, 1)
    assert.equal(Game.score, score)
    assert.equal(Game.boss, null)
    assert.equal(Game.bossCount, 0)
    assert.ok(Object.values(Game.enemies).every(enemy => enemy.profile.level === 4))
    const time = Game.progressionTime
    Game.updateProgression(200)
    Game.increaseDifficulty()
    assert.equal(Game.progressionTime, time)
    assert.equal(Game.difficulty, 5)
    assert.equal(Game.boss, null)
    assert.equal(Game.canPrepareEnemyAttack(), true, 'remaining UFOs can still attack')
    Game.meteors.environmental = { index: 'environmental' }
    Game.powerUps.energy = { isEnergyPickup: true }
    Game.powerUps.combat = { isEnergyPickup: false }
    for (const enemy of Object.values(Game.enemies)) enemy.die()
    assert.equal(Game.pendingSpawns.length, 0, 'kills during boss preparation do not reserve replacements')
    assert.ok(Game.score > score)
    Game.pause()
    Game.updateProgression(0)
    assert.equal(Game.boss, null)
    Game.unPause()
    Game.updateProgression(0)
    assert.equal(Game.waveStage, 'boss')
    assert.equal(Game.bossCount, 1)
    assert.equal(Game.nextBossAt, 9)
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    assert.equal(Object.keys(Game.meteors).length, 0, 'boss encounters remove environmental meteors')
    assert.equal(Game.powerUps.energy, undefined, 'boss encounters remove uncollected energy capsules')
    assert.ok(Game.powerUps.combat, 'combat power-ups remain owned by their original lifecycle')
    const boss = Game.boss
    Game.updateProgression(200)
    assert.equal(Game.boss, boss)
})

test('boss defeat gives a safe recovery and refills the complete normal wave', () => {
    const { Game, Boss, app } = setup()
    const boss = Game.spawnBossForTest()
    Game.fireEnemyVolley(100, 100, 3, '#FF3300', [0])
    boss.die()
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    assert.equal(Game.waveStage, 'recovery')
    assert.equal(Game.recoveryTime, app.config.progression.bossRecovery)
    assert.equal(Game.pendingSpawns.length, 0)
    Game.updateProgression(1)
    Game.updateSpawns(1)
    assert.equal(Object.keys(Game.enemies).length, 0)
    Game.updateProgression(1)
    assert.equal(Game.waveStage, 'wave')
    assert.equal(Game.pendingSpawns.length, Game.maxEnemies)
    assert.equal(Game.bannerMessage, null, 'resuming combat does not announce a wave')
    Game.updateSpawns(0.5)
    assert.equal(Object.keys(Game.enemies).length, 1, 'return is staggered')
    Game.advanceSpawnsForTest(8)
    assert.equal(Object.keys(Game.enemies).length, Game.maxEnemies)
    assert.equal(Game.enemiesAlive, Game.maxEnemies)
    assert.equal(Game.pendingSpawns.length, 0)
})

test('bombs and repeated fill requests cannot overbook enemy slots', () => {
    const { Game } = setup()
    const bomb = new Game.entities.PowerUp(100, 100)
    bomb.type = 'bomb'
    bomb.activate()
    for (let i = 0; i < 5; i++) Game.fillEnemySlots()
    assert.equal(Game.pendingSpawns.length, Game.maxEnemies)
    assert.equal(Game.scheduleEnemy(0), false)
    Game.advanceSpawnsForTest(8)
    assert.equal(Object.keys(Game.enemies).length, Game.maxEnemies)
    assert.equal(Game.enemiesAlive, Game.maxEnemies)
})

test('late progression caps enemies, projectile speed and density without accelerating the player', () => {
    const { Game, app } = setup()
    const early = app.progression.profile(1)
    const late = app.progression.profile(500)
    assert.ok(late.bulletSpeed > early.bulletSpeed)
    assert.ok(late.shootInterval < early.shootInterval)
    assert.equal(late.maxEnemies, 10)
    assert.ok(late.enemySpeed <= 3.6)
    assert.ok(late.bulletSpeed <= app.config.progression.maxBulletSpeed)
    Game.player.x = 100
    Game.player.movingRight = true
    Game.player.update()
    const earlyMove = Game.player.x - 100
    Game.difficulty = 500
    Game.configureEnemiesForTest()
    Game.player.x = 100
    Game.player.update()
    assert.equal(Game.player.x - 100, earlyMove)
    Game.player.shoot()
    assert.equal(Object.values(Game.bullets)[0].vy, 7)
    for (let i = 0; i < app.config.progression.maxEnemyBullets; i++) {
        Game.fireEnemyVolley(100, 100, 100, 'lime', [0])
    }
    assert.equal(Object.keys(Game.enemyBullets).length, 72)
    assert.equal(Game.fireEnemyVolley(100, 100, 3, 'lime', [-0.2, 0, 0.2]).length, 0)
    assert.ok(Object.values(Game.enemyBullets).every(bullet => bullet.vy <= 6.2))
})

test('advanced formations combine controller fans with aggressor-only homing', () => {
    const { Game } = setup()
    Game.difficulty = 6
    Game.configureEnemiesForTest()
    const enemies = Object.values(Game.enemies)
    const patrol = enemies[0]
    patrol.salvo = 1
    patrol.shoot()
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    assert.equal(patrol.pendingAttack.kind, 'fan')
    Game.dt = 0.8
    patrol.update()
    let bullets = Object.values(Game.enemyBullets)
    assert.equal(bullets.length, 4)
    assert.ok(bullets.every(bullet => bullet.isFan && !bullet.homing && bullet.wobbleAmp === 0))
    Game.enemyBullets = {}
    Game.updateProgression(Game.safeCorridor.remaining)
    Game.enemyAttackCooldown = 0
    const diver = enemies[3]
    assert.equal(diver.pattern, 'diver')
    diver.x = Game.view.width - diver.width
    Game.player.x = 0
    assert.equal(diver.shoot(), false, 'aggressor waits until its sensor detects the player')
    Game.player.x = diver.x - Game.player.width
    assert.equal(diver.shoot(), true)
    assert.equal(Object.keys(Game.enemyBullets).length, 0, 'tracking shots warn before firing')
    assert.equal(diver.pendingAttack.kind, 'tracking')
    Game.dt = 0.7
    diver.update()
    bullets = Object.values(Game.enemyBullets)
    assert.equal(bullets.length, 1)
    assert.equal(bullets[0].vx, 0)
    assert.equal(bullets[0].attackType, 'aggressor')
    assert.equal(bullets[0].color, Game.config.enemyAttackColors.aggressor)
    assert.equal(bullets[0].homing, true)
    Game.enemyBullets = {}
    Game.difficulty = 8
    Game.configureEnemiesForTest()
    Game.enemyAttackCooldown = 0
    Game.enemyAttackTurn = diver.index
    for (const actor of Object.values(Game.enemies)) {
        if (actor !== diver && actor.role !== 'pressure') actor.shootTimer = 0
    }
    diver.shoot()
    assert.equal(diver.pendingAttack.kind, 'tracking')
    diver.update()
    const homing = Object.values(Game.enemyBullets)[0]
    assert.equal(homing.homing, true)
    Game.dt = 0.5
    homing.update()
    homing.update()
    const vx = homing.vx
    homing.update()
    assert.equal(homing.vx, vx, 'steering ends after its limited tracking window')
})

test('boss phases change volleys and always warn before firing', () => {
    const { Game, Boss } = setup()
    const boss = Game.spawnBossForTest()
    boss.entering = false
    boss.y = 15
    boss.prepareAttack()
    assert.equal(boss.warningAngles.length, 5)
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    Game.dt = 0.3
    const x = boss.x
    boss.update()
    boss.update()
    assert.equal(boss.x, x, 'the warning origin stays stationary')
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    boss.update()
    assert.equal(Object.keys(Game.enemyBullets).length, 5)
    Game.enemyBullets = {}
    Game.updateProgression(0.45)
    boss.hp = boss.maxHp * 0.6
    boss.updatePhase()
    assert.equal(boss.phase, 2)
    boss.prepareAttack()
    assert.equal(boss.warningAngles.length, 3)
    const aim = Array.from(boss.warningAngles)
    Game.player.x = Game.view.width - Game.player.width
    boss.update()
    assert.deepEqual(Array.from(boss.warningAngles), aim, 'aim locks before the warning')
    boss.hp = boss.maxHp * 0.2
    boss.updatePhase()
    assert.equal(boss.phase, 3)
    assert.equal(boss.warningTime, 0, 'changing phase cancels the previous volley')
    boss.prepareAttack()
    assert.equal(boss.warningPattern, 'crossfire')
    assert.equal(boss.warningAngles.length, 7)
    assert.equal(Game.safeCorridor, null)
    Game.dt = Game.config.progression.bossWarning
    boss.update()
    assert.equal(Object.keys(Game.enemyBullets).length, 7)
})

test('all movement patterns stay above the player and inside a narrow screen', () => {
    const { Game } = setup({ width: 360, height: 780 })
    Game.difficulty = 20
    Game.configureEnemiesForTest()
    Game.dt = 0.05
    for (let step = 0; step < 300; step++) {
        for (const enemy of Object.values(Game.enemies)) {
            enemy.update()
            assert.ok(enemy.x >= 0 && enemy.x + enemy.width <= Game.view.width)
            assert.ok(enemy.y >= 10 && enemy.y <= enemy.maxY)
            assert.ok(enemy.y + enemy.height < Game.player.y)
        }
    }
})

test('successive bosses keep their minimum gap and restart clears recovery slots', () => {
    const { Game } = setup()
    const levels = []
    for (let i = 0; i < 11; i++) {
        Game.increaseDifficulty()
        if (Game.waveStage === 'boss-pending') {
            for (const enemy of Object.values(Game.enemies)) enemy.die()
            Game.updateProgression(0)
        }
        if (Game.boss) {
            levels.push(Game.difficulty)
            Game.boss.die()
            Game.updateProgression(2)
            Game.updateSpawns(10)
        }
    }
    assert.deepEqual(levels, [5, 9, 12])
    Game.difficulty = Game.nextBossAt - 1
    Game.increaseDifficulty()
    for (const enemy of Object.values(Game.enemies)) enemy.die()
    Game.updateProgression(0)
    Game.boss.die()
    Game.init()
    assert.equal(Game.waveStage, 'intro')
    assert.equal(Game.difficulty, 1)
    assert.equal(Game.progressionTime, 0)
    assert.equal(Game.recoveryTime, 0)
    assert.equal(Game.pendingSpawns.length, 6)
    assert.equal(Game.enemiesAlive, 6)
})

test('pausing freezes the recovery countdown and resuming keeps a single loop', () => {
    const { Game, Boss, frames, frame } = setup()
    Game.spawnBossForTest().die()
    Game.pause()
    assert.equal(Game.recoveryTime, 2)
    assert.equal(Game.pendingSpawns.length, 0)
    assert.equal(frames.size, 0)
    Game.continued()
    frame()
    assert.ok(Game.recoveryTime < 2)
    assert.equal(Game.pendingSpawns.length, 0)
    assert.equal(Game.progressionTime, 0)
    assert.equal(frames.size, 1)
})

test('fatal hit during a wave banner leaves Game Over as the final drawing', () => {
    const { Game, frame, frames, drawnTexts, resize } = setup()
    Game.levelUpTimer = 2
    Game.levelFlash = 0.5
    Game.life = Game.maxLives - 1
    Game.player.invincible = false
    new Game.entities.EnemyBullet(Game.player.x + Game.player.width / 2, Game.player.y, 1, 'lime', 0)
    frame()
    assert.equal(Game.isGameOver, true)
    assert.equal(Game.levelUpTimer, 0)
    assert.equal(Game.levelFlash, 0)
    assert.equal(frames.size, 0)
    assert.ok(drawnTexts.includes('GAME OVER'))
    assert.equal(drawnTexts.at(-1), 'CLIC O ENTER PARA VOLVER A JUGAR')
    assert.ok(!drawnTexts.some(text => text.startsWith('NIVEL') || text.includes('OLEADA') || text === 'ZONA DESPEJADA'))
    drawnTexts.length = 0
    // A later repaint cannot revive a banner, even if a stale timer is set.
    Game.levelUpTimer = 2
    resize(1280, 720)
    assert.equal(drawnTexts.at(-1), 'CLIC O ENTER PARA VOLVER A JUGAR')
    assert.ok(!drawnTexts.some(text => text.startsWith('NIVEL') || text.includes('OLEADA')))
})

test('continuous levels announce only advancement and preserve ongoing enemies', () => {
    const { Game, drawnTexts } = setup()
    const survivor = Object.values(Game.enemies)[0]
    Game.updateScore()
    assert.ok(!drawnTexts.includes('NIVEL 1'))
    Game.updateProgression(19.9)
    assert.equal(Game.difficulty, 1)
    Game.updateProgression(0.2)
    assert.equal(Game.difficulty, 2)
    assert.equal(Game.bannerMessage, 'NIVEL 2')
    assert.equal(Game.bannerDuration, 2.5)
    assert.equal(Game.enemies[survivor.index], survivor)
    assert.equal(survivor.dead, false)
    Game.updateScore()
    assert.ok(drawnTexts.includes('NIVEL 2'))
    assert.ok(!drawnTexts.some(text => text.includes('OLEADA')))
    for (const enemy of Object.values(Game.enemies)) enemy.die()
    assert.equal(Game.pendingSpawns.length, Game.maxEnemies)
    Game.updateProgression(0)
    assert.equal(Game.waveStage, 'wave')
    Game.advanceSpawnsForTest(8)
    assert.equal(Object.keys(Game.enemies).length, Game.maxEnemies)
})

test('four timed advances lead to the first boss and combat resumes silently', () => {
    const { Game } = setup()
    for (let i = 0; i < 4; i++) Game.updateProgression(20)
    assert.equal(Game.difficulty, 5)
    assert.equal(Game.waveStage, 'boss-pending')
    for (const enemy of Object.values(Game.enemies)) enemy.die()
    Game.updateProgression(0)
    assert.equal(Game.waveStage, 'boss')
    assert.equal(Game.bannerMessage, '¡JEFE!')
    assert.equal(Game.bannerDuration, 3)
    const time = Game.progressionTime
    Game.updateProgression(100)
    assert.equal(Game.progressionTime, time)
    Game.boss.die()
    assert.equal(Game.bannerMessage, 'ZONA DESPEJADA')
    Game.updateProgression(2)
    assert.equal(Game.waveStage, 'wave')
    assert.equal(Game.bannerMessage, null)
    assert.equal(Game.difficulty, 5)
    Game.advanceSpawnsForTest(8)
    assert.equal(Object.keys(Game.enemies).length, Game.maxEnemies)
    Game.updateProgression(20)
    assert.equal(Game.difficulty, 6)
    assert.equal(Game.bannerMessage, 'NIVEL 6')
})

test('aggressors require detection, lock their warning and then release a tracking round', () => {
    const { Game } = setup({ width: 2560, height: 1080 })
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    const enemy = Game.enemies[3]
    enemy.x = Game.view.width - enemy.width
    enemy.y = 20
    Game.player.x = 50
    assert.equal(enemy.shoot(), false, 'a distant player stays outside the aggressor sensor')
    Game.player.x = enemy.x - Game.player.width
    assert.equal(enemy.shoot(), true)
    const { targetX, targetY, angle } = enemy.pendingAttack
    const origin = [enemy.x, enemy.y]
    assert.equal(targetX, Game.player.x + Game.player.width / 2)
    assert.equal(angle, 0)
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    Game.player.x = Game.view.width - Game.player.width
    Game.dt = 0.3
    enemy.update()
    enemy.update()
    assert.deepEqual([enemy.x, enemy.y], origin)
    assert.equal(enemy.pendingAttack.targetX, targetX)
    assert.equal(enemy.pendingAttack.targetY, targetY)
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    Game.dt = 0.2
    enemy.update()
    const bullets = Object.values(Game.enemyBullets)
    assert.equal(bullets.length, 1)
    assert.equal(bullets[0].homing, true)
    assert.equal(bullets[0].attackType, 'aggressor')
    assert.equal(bullets[0].color, Game.config.enemyAttackColors.aggressor)
    assert.equal(bullets[0].vx, 0)
    const vx = bullets[0].vx
    bullets[0].update()
    assert.notEqual(bullets[0].vx, vx, 'only the aggressor projectile retargets after firing')
})

test('marksmen telegraph a locked trajectory without creating a safe corridor', () => {
    const { Game } = setup({ width: 900, height: 540 })
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    const marksman = Object.values(Game.enemies).find(enemy => enemy.role === 'marksman')
    assert.ok(marksman)
    marksman.x = Game.player.x - 120
    marksman.y = 90
    Game.player.horizontalVelocity = Game.player.speed * 60
    Game.enemyAttackCooldown = 0
    assert.equal(marksman.shoot(), true)
    assert.equal(marksman.pendingAttack.kind, 'aimed')
    assert.equal(Game.safeCorridor, null)
    const locked = {
        targetX: marksman.pendingAttack.targetX,
        targetY: marksman.pendingAttack.targetY,
        angle: marksman.pendingAttack.angle
    }
    assert.ok(locked.targetX > Game.player.x + Game.player.width / 2)
    assert.ok(marksman.pendingAttack.leadTime >= 0.25 && marksman.pendingAttack.leadTime <= 0.45)
    Game.player.x = 0
    Game.dt = Game.config.progression.enemyWarning / 2
    marksman.update()
    assert.deepEqual({
        targetX: marksman.pendingAttack.targetX,
        targetY: marksman.pendingAttack.targetY,
        angle: marksman.pendingAttack.angle
    }, locked)
    marksman.update()
    const shot = Object.values(Game.enemyBullets)[0]
    assert.equal(shot.attackType, 'precision')
    assert.equal(shot.color, Game.config.enemyAttackColors.precision)
    assert.equal(shot.homing, false)
    assert.ok(Math.abs(Math.atan2(shot.vx, shot.vy) - locked.angle) < 0.000001)
    assert.equal(Game.safeCorridor, null)
})

test('destroying an enemy on the final charge frame cancels its shot', () => {
    const { Game, Bullet } = setup()
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    const enemy = Game.enemies[3]
    enemy.shoot()
    const bullet = new Bullet(enemy.x + 20, 0)
    bullet.y = enemy.y + 10
    Game.dt = 0.65
    enemy.update()
    assert.equal(enemy.dead, true)
    assert.equal(enemy.pendingAttack, null)
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    assert.equal(Game.enemyAttackCooldown, 0.45)
    assert.ok(Game.score > 0)
})

test('only one dangerous shot charges at once, followed by a shared recovery gap', () => {
    const { Game, Enemy } = setup()
    Game.difficulty = 8
    Game.configureEnemiesForTest()
    for (const actor of Object.values(Game.enemies)) actor.shootTimer = 0
    const second = new Enemy()
    second.entering = false
    second.y = 20
    second.x = Game.player.x
    const first = Game.enemies[3]
    assert.equal(first.shoot(), true)
    assert.equal(second.shoot(), false)
    assert.equal(second.pendingAttack, null)
    Game.dt = 0.7
    first.update()
    assert.equal(second.shoot(), false, 'next attacker waits after the shot')
    Game.updateProgression(0.45)
    assert.equal(second.shoot(), true)
    assert.equal(Object.values(Game.enemies).filter(enemy => enemy.pendingAttack).length, 1)
})

test('pause and resize preserve an attack target without tracking the player', () => {
    const { Game, resize, frames } = setup()
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    const enemy = Game.enemies[3]
    enemy.shoot()
    const targetX = enemy.pendingAttack.targetX
    Game.player.x = 0
    Game.pause()
    Game.dt = 1
    enemy.update()
    assert.equal(enemy.pendingAttack.remaining, 0.65)
    assert.equal(frames.size, 0)
    resize(1920, 1080)
    assert.ok(Math.abs(enemy.pendingAttack.targetX - targetX * 960 / 900) < 0.000001)
    assert.notEqual(enemy.pendingAttack.targetX, Game.player.x + Game.player.width / 2)
    assert.equal(enemy.pendingAttack.remaining, 0.65)
    Game.continued()
    enemy.update()
    assert.equal(Object.keys(Game.enemyBullets).length, 1)
})

test('pending boss preserves live charges and later boss entry and restart prevent ghost shots', () => {
    const { Game, Boss, prepareCombat } = setup()
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    const enemy = Game.enemies[3]
    enemy.shoot()
    const charge = enemy.pendingAttack
    Game.increaseDifficulty()
    assert.equal(enemy.pendingAttack, charge)
    assert.equal(Game.waveStage, 'boss-pending')
    Game.dt = 1
    enemy.update()
    assert.equal(Object.keys(Game.enemyBullets).length, 1)
    for (const actor of Object.values(Game.enemies)) actor.die()
    Game.updateProgression(0)
    assert.equal(Game.waveStage, 'boss')
    enemy.update()
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    Game.init()
    prepareCombat()
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    const another = Game.enemies[3]
    another.shoot()
    Game.spawnBossForTest()
    another.update()
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    Game.init()
    another.update()
    assert.equal(another.shoot(), false)
    assert.equal(Game.enemyAttackCooldown, 0)
    assert.ok(Object.values(Game.enemies).every(actor => actor.pendingAttack === null))
})

test('normal fans leave a reachable ship-sized gap across narrow and wide screens', () => {
    for (const [width, height] of [[360, 780], [900, 540], [2560, 1080]]) {
        for (const level of [6, 12, 40]) {
            for (const side of [0, 0.5, 1]) {
                const { Game, app } = setup({ width, height })
                Game.difficulty = level
                Game.configureEnemiesForTest()
                const enemy = Game.enemies[0]
                enemy.x = side * (Game.view.width - enemy.width)
                enemy.y = enemy.maxY
                enemy.salvo = 1
                const playerCenter = Game.player.x + Game.player.width / 2
                assert.equal(enemy.shoot(), true)
                const gap = Game.safeCorridor
                assert.ok(gap.width >= Game.player.width + 2 * app.config.progression.fanGapPadding)
                const movementTime = Math.abs(gap.center - playerCenter) / (Game.player.speed * 60)
                assert.ok(movementTime + 0.25 <= app.config.progression.fanWarning, 'room for movement and reaction')
                Game.player.x = gap.center - Game.player.width / 2
                Game.dt = 0.8
                enemy.update()
                assert.equal(Object.keys(Game.enemyBullets).length, 4)
                assert.equal(gap.fired, true)
                const lifetime = gap.remaining + 0.2
                Game.dt = 1 / 120
                for (let time = 0; time < lifetime; time += Game.dt) {
                    for (const bullet of Object.values(Game.enemyBullets)) {
                        bullet.update()
                        assert.equal(Game.collision(bullet, Game.player), false,
                            'fan must clear the entire ship, including its nose and tail')
                    }
                    Game.updateProgression(Game.dt)
                }
                assert.equal(Game.safeCorridor, null)
            }
        }
    }
})

test('a fan waits for existing danger and prevents other shots from blocking the gap', () => {
    const { Game } = setup()
    Game.difficulty = 12
    Game.configureEnemiesForTest()
    // Isolate refuge geometry from the randomized readiness of other specialists.
    for (const actor of Object.values(Game.enemies)) actor.shootTimer = 0
    const enemy = Game.enemies[0]
    enemy.salvo = 1
    const oldPlayerCenter = Game.player.x + Game.player.width / 2
    const blocker = new Game.entities.EnemyBullet(oldPlayerCenter, Game.player.y - 30, 3, 'lime', 0)
    assert.equal(enemy.shoot(), false, 'approach path is blocked before the warning')
    assert.equal(Game.safeCorridor, null)
    delete Game.enemyBullets[blocker.index]
    assert.equal(enemy.shoot(), true)
    const gap = Game.safeCorridor
    assert.equal(Game.fireEnemyVolley(gap.center, 100, 4, 'lime', [0]).length, 0)
    assert.equal(Game.fireEnemyVolley(oldPlayerCenter, Game.player.y - 30, 3, 'lime', [0]).length, 0)
    const diver = Game.enemies[3]
    assert.equal(diver.shoot(), false, 'directed attacks wait while the refuge is protected')
    Game.dt = 0.8
    enemy.update()
    assert.equal(gap.fired, true)
    assert.equal(Game.fireEnemyVolley(gap.center, 100, 4, 'lime', [0]).length, 0)
    assert.equal(Game.fireEnemyVolley(oldPlayerCenter, Game.player.y - 30, 3, 'lime', [0]).length, 1,
        'the approach protection ends after the charge')
})

test('boss fans preserve a gap through their final phase on a narrow screen', () => {
    const { Game, Boss } = setup({ width: 360, height: 780 })
    Game.difficulty = 20
    Game.configureEnemiesForTest()
    const boss = Game.spawnBossForTest()
    boss.entering = false
    boss.y = 15
    boss.hp = boss.maxHp * 0.2
    boss.updatePhase()
    boss.attackStep = 3
    assert.equal(boss.prepareAttack(), true)
    assert.equal(boss.warningAngles.length, 6)
    const gap = Game.safeCorridor
    Game.player.x = gap.center - Game.player.width / 2
    Game.dt = 0.7
    boss.update()
    assert.equal(Object.keys(Game.enemyBullets).length, 6)
    assert.equal(boss.prepareAttack(), false, 'next aimed volley waits for the corridor')
    const lifetime = gap.remaining + 0.2
    Game.dt = 1 / 120
    for (let time = 0; time < lifetime; time += Game.dt) {
        for (const bullet of Object.values(Game.enemyBullets)) {
            bullet.update()
            assert.equal(Game.collision(bullet, Game.player), false)
        }
        Game.updateProgression(Game.dt)
    }
    assert.equal(Game.safeCorridor, null)
    assert.equal(boss.prepareAttack(), true)
    assert.equal(boss.warningAngles.length, 5, 'phase-three aimed volley remains available')
})

test('fan reservations freeze in pause and are released on death, resize and restart', () => {
    const { Game, resize } = setup()
    Game.difficulty = 6
    Game.configureEnemiesForTest()
    const enemy = Game.enemies[0]
    enemy.salvo = 1
    enemy.shoot()
    const gap = Game.safeCorridor
    const remaining = gap.remaining
    Game.pause()
    Game.updateProgression(10)
    assert.equal(Game.safeCorridor.remaining, remaining)
    assert.equal(enemy.pendingAttack.remaining, 0.8)
    Game.continued()
    enemy.die()
    assert.equal(Game.safeCorridor, null)
    Game.enemyAttackCooldown = 0
    const other = Game.enemies[4]
    other.salvo = 1
    assert.equal(other.shoot(), true)
    resize(1280, 720)
    assert.equal(Game.safeCorridor, null)
    assert.equal(other.pendingAttack, null)
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
    Game.init()
    assert.equal(Game.safeCorridor, null)
    assert.ok(Object.values(Game.enemies).every(actor => actor.pendingAttack === null))
})

test('fan gaps vary progressively, remain inside the viewport and can be reached from its edges', () => {
    for (const [width, height] of [[360, 780], [900, 540], [2560, 1080]]) {
        const { Game, app } = setup({ width, height })
        Game.difficulty = 12
        Game.configureEnemiesForTest()
        const owner = Game.enemies[0]
        const centers = []
        for (const variation of [0, 1, 2]) {
            const gap = Game.reserveFan(owner, Game.view.width / 2, 100, 4, 2, 0.8, variation)
            centers.push(gap.center)
            Game.releaseFan(owner)
        }
        assert.ok(centers[0] < centers[1] && centers[1] < centers[2])
        for (const position of [0, Game.view.width - Game.player.width]) {
            Game.player.x = position
            for (const variation of [0, 1, 2]) {
                const gap = Game.reserveFan(owner, Game.view.width / 2, 100, 4, 2, 0.8, variation)
                assert.ok(gap.center - gap.width / 2 >= 16)
                assert.ok(gap.center + gap.width / 2 <= Game.view.width - 16)
                const travel = Math.abs(gap.center - (position + Game.player.width / 2)) / (Game.player.speed * 60)
                assert.ok(travel + 0.25 <= app.config.progression.fanWarning)
                Game.releaseFan(owner)
            }
        }
    }
})

test('enemy roles unlock gradually and specialists never fall back to pressure shots', () => {
    const { Game } = setup()
    assert.ok(Object.values(Game.enemies).every(enemy => enemy.role === 'pressure'))
    Game.difficulty = 2
    Game.configureEnemiesForTest()
    assert.equal(Game.enemies[3].role, 'aggressor')
    assert.equal(Game.waveProfile.tracking, false)
    assert.ok(Object.values(Game.enemies).every(enemy => enemy.role !== 'controller'))
    Game.difficulty = 6
    Game.configureEnemiesForTest()
    const controller = Game.enemies[0]
    const aggressor = Game.enemies[3]
    const marksman = Game.enemies[5]
    const pressure = Game.enemies[1]
    assert.equal(controller.role, 'controller')
    assert.equal(marksman.role, 'marksman')
    assert.ok(controller.shootInterval > pressure.shootInterval)
    assert.equal(controller.shoot(), true, 'first shot is already a fan')
    assert.equal(controller.pendingAttack.kind, 'fan')
    assert.equal(aggressor.shoot(), false, 'aggressor waits while the controller reserves space')
    assert.equal(Object.keys(Game.enemyBullets).length, 0, 'waiting specialists emit no fallback bullets')
    controller.die()
    assert.equal(Game.safeCorridor, null)
    assert.equal(aggressor.shoot(), false, 'cancellation keeps the recovery gap')
    Game.updateProgression(0.45)
    assert.equal(aggressor.shoot(), true)
    assert.equal(aggressor.pendingAttack.kind, 'tracking')
    pressure.x = Game.player.x + Game.player.width / 2 - pressure.width / 2
    assert.equal(pressure.shoot(), true, 'aligned common UFOs can continue during a tracking warning')
    assert.equal(pressure.pendingAttack, null)
    assert.equal(Object.keys(Game.enemyBullets).length, 1)
    const commonShot = Object.values(Game.enemyBullets)[0]
    assert.equal(commonShot.vx, 0)
    assert.equal(commonShot.color, Game.config.enemyAttackColors.common)
    assert.equal(commonShot.attackType, 'common')
})

test('common UFOs stay green and straight while aggressors recover tomato and later tracking', () => {
    const { Game } = setup()
    const enemy = Game.enemies[0]
    enemy.x = 0
    Game.player.x = Game.view.width / 2
    Game.player.movingRight = true
    Game.player.update()
    assert.equal(enemy.shoot(), true, 'common UFOs maintain steady baseline fire outside a narrow lane')
    assert.equal(Object.keys(Game.enemyBullets).length, 1)
    Game.enemyBullets = {}
    enemy.x = Game.player.x + Game.player.width / 2 - enemy.width / 2
    assert.equal(enemy.shoot(), true)
    const common = Object.values(Game.enemyBullets)[0]
    assert.equal(common.vx, 0)
    assert.ok(common.vy > 0)
    assert.equal(common.homing, false)
    assert.equal(common.color, Game.config.enemyAttackColors.common)
    assert.equal(common.attackType, 'common')

    Game.enemyBullets = {}
    Game.difficulty = 2
    Game.configureEnemiesForTest()
    let aggressor = Object.values(Game.enemies).find(actor => actor.role === 'aggressor')
    aggressor.x = 0
    Game.enemyAttackCooldown = 0
    assert.equal(aggressor.shoot(), false, 'level-two aggressors do not fire straight shots outside their lane')
    aggressor.x = Game.player.x
    Game.enemyAttackCooldown = 0
    assert.equal(aggressor.shoot(), true)
    assert.equal(aggressor.pendingAttack.kind, 'aggressive')
    Game.dt = Game.config.progression.enemyWarning
    aggressor.update()
    const legacyShot = Object.values(Game.enemyBullets)[0]
    assert.equal(legacyShot.homing, false)
    assert.equal(legacyShot.vx, 0)
    assert.equal(legacyShot.color, Game.config.enemyAttackColors.aggressor)
    assert.equal(legacyShot.attackType, 'aggressor')

    Game.enemyBullets = {}
    Game.difficulty = 3
    Game.configureEnemiesForTest()
    aggressor = Object.values(Game.enemies).find(actor => actor.role === 'aggressor')
    aggressor.x = Game.player.x
    Game.enemyAttackCooldown = 0
    assert.equal(aggressor.shoot(), true)
    assert.equal(aggressor.pendingAttack.kind, 'tracking')
    Game.dt = Game.config.progression.enemyWarning
    aggressor.update()
    const tracking = Object.values(Game.enemyBullets)[0]
    assert.equal(tracking.homing, true)
    assert.equal(tracking.isTracking, true)
    const initialVelocity = tracking.vx
    Game.player.x = initialVelocity >= 0 ? 0 : Game.view.width - Game.player.width
    Game.dt = 0.1
    tracking.update()
    assert.ok(initialVelocity >= 0 ? tracking.vx < initialVelocity : tracking.vx > initialVelocity)
})

test('specialist quotas survive successive replacements and level reconfiguration', () => {
    const { Game, Enemy, app } = setup()
    Game.difficulty = 12
    Game.configureEnemiesForTest()
    Game.fillEnemySlots(0)
    Game.advanceSpawnsForTest(8)
    const check = () => {
        const enemies = Object.values(Game.enemies)
        for (const role of ['aggressor', 'marksman', 'controller']) {
            assert.ok(enemies.filter(enemy => enemy.role === role).length <= app.config.progression.maxSpecialistsPerRole)
        }
        assert.ok(enemies.some(enemy => enemy.role === 'pressure'))
        assert.equal(enemies.length, Game.maxEnemies)
    }
    check()
    for (let i = 0; i < 80; i++) {
        Object.values(Game.enemies)[i % Game.maxEnemies].die()
        Game.pendingSpawns = []
        new Enemy()
        check()
        Game.configureEnemiesForTest()
        check()
    }
    Game.init()
    assert.ok(Object.values(Game.enemies).every(enemy => enemy.role === 'pressure'))
})

test('ready specialists rotate instead of allowing the first controller to monopolize charges', () => {
    const { Game } = setup()
    Game.difficulty = 6
    Game.configureEnemiesForTest()
    const actors = [Game.enemies[0], Game.enemies[3], Game.enemies[4], Game.enemies[5]]
    for (const actor of actors) {
        actor.shootTimer = actor.shootInterval
        actor.x = Game.player.x
    }
    for (const expected of [0, 3, 4, 5, 0, 3, 4, 5]) {
        let charged = null
        for (const actor of actors) {
            if (actor.shoot()) { charged = actor; break }
        }
        assert.equal(charged?.index, expected)
        if (charged.pendingAttack.kind === 'fan') Game.releaseFan(charged)
        charged.pendingAttack = null
    }
    Game.init()
    assert.equal(Game.enemyAttackTurn, 0)
})

test('a ready specialist outside radar cannot block one that has acquired the player', () => {
    const { Game } = setup()
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    const aggressor = Object.values(Game.enemies).find(enemy => enemy.role === 'aggressor')
    const marksman = Object.values(Game.enemies).find(enemy => enemy.role === 'marksman')
    Game.player.x = Game.view.width - Game.player.width
    aggressor.x = 0
    marksman.x = Game.player.x
    aggressor.shootTimer = aggressor.shootInterval
    marksman.shootTimer = marksman.shootInterval
    assert.equal(aggressor.canAcquireTarget(), false)
    assert.equal(marksman.canAcquireTarget(), true)
    assert.equal(marksman.shoot(), true)
    assert.equal(marksman.pendingAttack.kind, 'aimed')
})

test('specialist AI acquires, cancels on radar loss and can acquire again', () => {
    const { Game } = setup()
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    const aggressor = Object.values(Game.enemies).find(enemy => enemy.role === 'aggressor')
    aggressor.speed = 0
    aggressor.x = 0
    Game.player.x = 0
    aggressor.shootTimer = aggressor.shootInterval
    aggressor.setAIState(Game.rules.ENEMY_AI_STATES.PATROL)

    Game.dt = 0.1
    aggressor.update()
    assert.equal(aggressor.ai.state, Game.rules.ENEMY_AI_STATES.ACQUIRING)
    assert.equal(aggressor.pendingAttack, null)
    assert.ok(aggressor.ai.lastKnownTarget)

    Game.player.x = Game.view.width - Game.player.width
    aggressor.update()
    assert.equal(aggressor.ai.state, Game.rules.ENEMY_AI_STATES.PATROL)
    assert.equal(aggressor.ai.lastKnownTarget, null)

    Game.player.x = 0
    aggressor.update()
    for (let frame = 0; frame < 3; frame++) aggressor.update()
    assert.equal(aggressor.ai.state, Game.rules.ENEMY_AI_STATES.WARNING)
    assert.equal(aggressor.pendingAttack.kind, 'tracking')
})

test('destroying a controller after firing preserves the refuge for surviving projectiles', () => {
    const { Game } = setup()
    Game.difficulty = 6
    Game.configureEnemiesForTest()
    const controller = Game.enemies[0]
    controller.shoot()
    Game.dt = 0.8
    controller.update()
    const refuge = Game.safeCorridor
    assert.equal(refuge.fired, true)
    controller.die()
    assert.equal(Game.safeCorridor, refuge)
    assert.equal(Object.keys(Game.enemyBullets).length, 4)
    assert.equal(Game.enemies[3].shoot(), false)
})

test('first-level formations stay wholly in the upper 30 percent, including narrow screens and resize', () => {
    for (const [width, height] of [[900, 540], [360, 540], [360, 780], [2560, 1080]]) {
        const { Game, app, resize } = setup({ readyEnemies: false, width, height })
        let visible = 0
        for (let frame = 0; frame < 350; frame++) {
            Game.invincibleMode(1000000)
            Game.updateWorld(0.05)
            assert.equal(Game.difficulty, 1)
            const enemies = Object.values(Game.enemies)
            visible = Math.max(visible, enemies.filter(enemy => !enemy.entering).length)
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i]
                assert.ok(enemy.y + enemy.height <= Game.view.height * app.config.progression.initialEnemyDepth + 0.000001,
                    'entry and patrol keep the entire ship above the introductory depth limit')
                for (let j = i + 1; j < enemies.length; j++) {
                    assert.equal(app.domain.formation.overlaps(enemy, enemies[j], 11.999), false)
                }
            }
        }
        assert.ok(visible >= 2, 'the upper formation remains populated')
        resize(360, 540)
        assert.ok(Object.values(Game.enemies).every(enemy => enemy.y + enemy.height <= Game.view.height * 0.3 + 0.000001))
        Game.difficulty = 4
        Game.configureEnemiesForTest()
        assert.ok(Object.values(Game.enemies).some(enemy => enemy.role === 'aggressor'
            && enemy.maxY > Game.view.height * 0.3 - enemy.height), 'deeper incursions remain unlocked later')
    }
})

test('cold starts and restarts give three enemy-free seconds without advancing difficulty', () => {
    const { Game, app, frames } = setup({ readyEnemies: false })
    const delay = app.config.progression.introDuration
    assert.equal(Object.keys(Game.enemies).length, 0)
    assert.equal(Game.pendingSpawns.length, 6)
    assert.equal(Game.levelUpTimer, 0)
    for (let i = 0; i < 59; i++) Game.updateWorld(0.05)
    assert.equal(Object.keys(Game.enemies).length, 0)
    assert.equal(Game.progressionTime, 0)
    const remaining = Game.introRemaining
    Game.pause()
    Game.updateWorld(10)
    assert.equal(Game.introRemaining, remaining)
    Game.unPause()
    for (let i = 0; i < 3; i++) Game.updateWorld(0.05)
    assert.equal(Object.keys(Game.enemies).length, 1)
    const first = Object.values(Game.enemies)[0]
    assert.equal(first.entering, true)
    assert.ok(first.y < 0)
    assert.equal(first.shoot(), false, 'entry cannot fire')
    assert.ok(Game.progressionTime < 0.2)
    Game.init()
    assert.equal(Game.introRemaining, delay)
    assert.equal(Game.pendingSpawns.length, 6)
    assert.equal(Object.keys(Game.enemies).length, 0)
    assert.equal(frames.size, 1)
})

test('overdue spawn reservations are staggered and remain reserved when the entrance is blocked', () => {
    const { Game, app } = setup({ readyEnemies: false })
    Game.waveStage = 'wave'
    Game.introRemaining = 0
    Game.updateSpawns(100)
    assert.equal(Object.keys(Game.enemies).length, 1, 'a long frame creates only one enemy')
    assert.equal(Game.pendingSpawns.length, 5)
    Game.updateSpawns(0)
    assert.equal(Object.keys(Game.enemies).length, 1)
    const enemy = Object.values(Game.enemies)[0]
    const bounds = Game.enemyBounds(false, 1)
    enemy.width = Game.view.width
    enemy.x = 0
    enemy.entryTargetX = 0
    enemy.entryY = bounds.top
    enemy.height = bounds.bottom - bounds.top
    Game.updateSpawns(app.config.progression.spawnSpacing)
    assert.equal(Game.pendingSpawns.length, 5, 'blocked entrance does not lose its reservation')
    enemy.width = Game.config.enemySize.width
    enemy.height = Game.config.enemySize.height
    enemy.entering = false
    enemy.y = bounds.bottom + app.config.progression.enemySeparation
    Game.updateSpawns(0.01)
    assert.equal(Object.keys(Game.enemies).length, 2)
    assert.equal(Game.enemiesAlive, 6)
})

test('arrivals reserve distinct landing slots and never remain suspended at the top', () => {
    const { Game, app } = setup({ readyEnemies: false, width: 900, height: 540 })
    Game.waveStage = 'wave'
    Game.introRemaining = 0
    Game.random = minimum => minimum
    Game.updateSpawns(100)
    Game.updateSpawns(app.config.progression.spawnSpacing)
    const arrivals = Object.values(Game.enemies)
    assert.equal(arrivals.length, 2)
    assert.notDeepEqual(
        arrivals.map(enemy => [enemy.entryTargetX, enemy.entryY]),
        [[arrivals[0].entryTargetX, arrivals[0].entryY], [arrivals[0].entryTargetX, arrivals[0].entryY]],
        'each arrival owns a distinct complete landing slot'
    )
    Game.dt = 0.02
    for (let frame = 0; frame < 160; frame++) arrivals.forEach(enemy => enemy.update())
    assert.ok(arrivals.every(enemy => !enemy.entering))
    assert.ok(arrivals.every(enemy => enemy.y >= enemy.minY))
})

test('simulation keeps formations separated through combat, bosses, respawns and resize', () => {
    for (const seed of [1, 42, 2026]) {
        for (const [width, height] of [[360, 780], [900, 540], [2560, 1080]]) {
            const { Game, app, resize } = setup({ readyEnemies: false, width, height, seed })
            Game.player.invincibleTimer = 10000
            Game.shooting = true
            let visible = 0
            for (let step = 0; step < 1800; step++) {
                if (step === 350) { Game.difficulty = 8; Game.configureEnemiesForTest(); Game.fillEnemySlots() }
                if (step === 800) resize(360, 540)
                if (step === 1100) resize(1920, 1080)
                if (Game.boss && step % 200 === 0) Game.boss.die()
                Game.player.movingRight = step % 200 < 100
                Game.player.movingLeft = !Game.player.movingRight
                Game.invincibleMode(1000000)
                Game.player.shield = 10000
                Game.updateWorld(0.05)
                assert.equal(Game.isGameOver, false)
                const enemies = Object.values(Game.enemies)
                visible = Math.max(visible, enemies.filter(enemy => !enemy.entering).length)
                assert.ok(enemies.length + Game.pendingSpawns.length <= Game.maxEnemies)
                assert.ok(Object.keys(Game.enemyBullets).length <= app.config.progression.maxEnemyBullets)
                assert.ok(enemies.filter(enemy => enemy.pendingAttack).length <= 1)
                for (let i = 0; i < enemies.length; i++) {
                    const enemy = enemies[i]
                    assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y))
                    assert.ok(enemy.entering
                        ? enemy.x + enemy.width >= -app.config.progression.enemySeparation
                            && enemy.x <= Game.view.width + app.config.progression.enemySeparation
                        : enemy.x >= 0 && enemy.x + enemy.width <= Game.view.width + 0.000001)
                    for (let j = i + 1; j < enemies.length; j++) {
                        assert.equal(app.domain.formation.overlaps(enemy, enemies[j], app.config.progression.enemySeparation - 0.000001), false,
                            'enemy bodies retain a visible margin, including during entry')
                    }
                }
            }
            assert.ok(visible >= 3, 'separation must still allow a playable formation')
            assert.ok(Game.score > 0, 'the simulation includes shooting and defeated enemies')
        }
    }
})

test('drawing and repainting never advance effects or gameplay state', () => {
    const { Game } = setup()
    const particle = new Game.entities.Particle(100, 100)
    const text = new Game.entities.FloatingText(100, 100, 'test')
    const pickup = new Game.entities.PowerUp(100, 100)
    const snapshot = () => JSON.stringify({
        particle: [particle.x, particle.y, particle.life, particle.size, particle.vy],
        text: [text.x, text.y, text.life], pickup: [pickup.x, pickup.y, pickup.pulse],
        elapsed: Game.elapsedTime, combo: Game.comboTimer, progression: Game.progressionTime,
        intro: Game.introRemaining, dt: Game.dt
    })
    const before = snapshot()
    Game.drawScene()
    Game.drawScene()
    assert.equal(snapshot(), before)
    Game.pause()
    Game.repaint()
    Game.repaint()
    assert.equal(snapshot(), before)
    Game.updateWorld(1)
    assert.equal(snapshot(), before)
    Game.unPause()
    Game.updateWorld(0.05)
    assert.notEqual(snapshot(), before)
})

test('opposite movement keys cancel at both edges and projectiles match their hitbox centers', () => {
    const { Game } = setup()
    const player = Game.player
    player.movingLeft = true
    player.movingRight = true
    for (const x of [0, Game.view.width - player.width]) {
        player.x = x
        player.update()
        assert.equal(player.x, x)
    }
    player.shoot()
    const bullet = Object.values(Game.bullets)[0]
    assert.equal(bullet.x + bullet.width / 2, player.x + player.width / 2)
    assert.equal(bullet.y + bullet.height, player.y)
})

test('visible UFOs take damage during entry and while waiting for a blocked lane at every level', () => {
    for (const level of [1, 4, 8, 20, 50]) {
        for (const blocked of [false, true]) {
            const { Game, Enemy, Bullet } = setup({ readyEnemies: false })
            Game.waveStage = 'wave'
            Game.pendingSpawns = []
            Game.difficulty = level
            Game.configureEnemiesForTest()
            const enemy = new Enemy({ x: 100, y: 20 })
            assert.equal(enemy.entering, true)
            if (blocked) Game.canMoveEnemy = () => false
            const bullet = new Bullet(enemy.x + enemy.width / 2, 0)
            bullet.y = enemy.y + enemy.height / 2
            enemy.update()
            assert.equal(enemy.dead, true, 'entry is not invulnerability, even when the descent is blocked')
            assert.equal(Game.bullets[bullet.index], undefined)
            assert.ok(Game.score > 0)
            assert.equal(enemy.shoot(), false)
        }
    }
})

test('a visible boss takes damage while entering without firing during its descent', () => {
    const { Game, Boss, Bullet } = setup()
    const boss = Game.spawnBossForTest()
    boss.y = -30
    const before = boss.hp
    const bullet = new Bullet(boss.x + boss.width / 2, 0)
    bullet.y = 20
    boss.update()
    assert.equal(boss.hp, before - 1)
    assert.equal(Game.bullets[bullet.index], undefined)
    assert.equal(Object.keys(Game.enemyBullets).length, 0)
})

test('straight and triple projectiles hit the first crossed UFO even when a step spans its body', () => {
    for (const level of [1, 8, 50]) {
        for (const vx of [0, -2.5, 2.5]) {
            const { Game, Enemy, Bullet } = setup({ readyEnemies: false })
            Game.waveStage = 'wave'
            Game.pendingSpawns = []
            Game.difficulty = level
            Game.configureEnemiesForTest()
            const lower = new Enemy({ x: 200, y: 190 })
            const upper = new Enemy({ x: 200, y: 78 })
            Game.player.tripleShot = vx ? 6 : 0
            const bullet = new Bullet(250, vx)
            bullet.y = 350
            bullet.vy = 80 // Deliberately exceeds normal movement to expose tunneling.
            Game.dt = 0.05
            assert.equal(Game.collision(bullet, lower), false)
            bullet.update()
            assert.equal(lower.dead, true)
            assert.equal(upper.dead, false, 'one projectile hits only the nearest crossed body')
            assert.equal(Game.bullets[bullet.index], undefined)
            assert.equal(Game.score, 15 + (level - 1) * 5, 'one hit awards one kill')
        }
    }
})

test('shots can hit a partially visible entrant without damaging ships wholly outside the screen', () => {
    const { Game, Enemy, Bullet } = setup({ readyEnemies: false })
    Game.waveStage = 'wave'
    Game.pendingSpawns = []
    const hidden = new Enemy({ x: 100, y: -72 })
    const visible = new Enemy({ x: 300, y: -50 })
    const shot = new Bullet(350, 0)
    shot.y = 21
    Game.dt = 0.05
    assert.equal(Game.collision(shot, visible), false)
    shot.update()
    assert.equal(visible.dead, true)
    assert.equal(hidden.dead, false)
    const outsideShot = new Bullet(150, 0)
    outsideShot.y = -5
    outsideShot.update()
    assert.equal(hidden.dead, false)
})

test('paused and stale projectiles cannot damage actors or remove a new session projectile', () => {
    const { Game, Bullet } = setup()
    const enemy = Game.enemies[0]
    const bullet = new Bullet(enemy.x + enemy.width / 2, 0)
    bullet.y = enemy.y
    Game.pause()
    bullet.update()
    assert.equal(enemy.dead, false)
    assert.equal(Game.bullets[bullet.index], bullet)
    Game.init()
    const fresh = new Bullet(200, 0)
    assert.equal(fresh.index, bullet.index)
    bullet.update()
    assert.equal(Game.bullets[fresh.index], fresh)
})

test('unobstructed waves and zigzags use their full vertical range without clipped plateaus', () => {
    for (const pattern of ['sine', 'zigzag']) {
        for (const [width, height] of [[900, 540], [360, 780]]) {
            const { Game, Enemy, app } = setup({ readyEnemies: false, width, height })
            Game.waveStage = 'wave'
            Game.pendingSpawns = []
            Game.difficulty = 3
            Game.configureEnemiesForTest()
            const enemy = new Enemy({ x: 100, y: 100 })
            enemy.pattern = pattern
            enemy.entering = false
            enemy.shootInterval = 100000
            Game.resetEnemyMotion(enemy)
            Game.dt = 0.02
            const positions = []
            let repeated = 0
            for (let step = 0; step < 400; step++) {
                enemy.update()
                assert.ok(enemy.y >= enemy.minY - 0.000001 && enemy.y <= enemy.maxY + 0.000001)
                if (step > 50) {
                    if (Math.abs(enemy.y - positions.at(-1)) < 0.000001) repeated++
                    positions.push(enemy.y)
                }
            }
            const expectedRange = pattern === 'sine' ? Math.min(2 * app.config.motion.waveAmplitude, enemy.maxY - enemy.minY)
                : enemy.maxY - enemy.minY
            assert.ok(Math.max(...positions) - Math.min(...positions) > expectedRange * 0.95)
            assert.ok(repeated <= 2, 'curves do not flatten against height limits')
        }
    }
})

test('blocked movement freezes its curve phase and resumes without skipping the vertical path', () => {
    const { Game, Enemy } = setup({ readyEnemies: false })
    Game.waveStage = 'wave'
    Game.pendingSpawns = []
    Game.difficulty = 2
    Game.configureEnemiesForTest()
    Game.enemyIndex = 1
    const enemy = new Enemy({ x: 100, y: 100 })
    enemy.pattern = 'sine'
    enemy.entering = false
    enemy.shootInterval = 100000
    Game.resetEnemyMotion(enemy)
    Game.dt = 0.05
    const canMove = Game.canMoveEnemy
    Game.canMoveEnemy = () => false
    for (let step = 0; step < 30; step++) enemy.update()
    assert.equal(enemy.motionTime, 0)
    assert.equal(enemy.y, 100)
    Game.canMoveEnemy = canMove
    enemy.update()
    assert.equal(enemy.motionTime, 0.05)
    assert.ok(Math.abs(enemy.y - 100) < 5)
})

test('a wave can leave a vertically blocked lane and resume its curve instead of deadlocking', () => {
    const { Game, Enemy } = setup({ readyEnemies: false })
    Game.waveStage = 'wave'
    Game.pendingSpawns = []
    Game.difficulty = 2
    Game.configureEnemiesForTest()
    Game.enemyIndex = 1
    const wave = new Enemy({ x: 100, y: 78 })
    wave.entering = false
    wave.movingLeft = false
    wave.shootInterval = 100000
    Game.resetEnemyMotion(wave)
    const blocker = new Enemy({ x: 100, y: 150 })
    blocker.entering = false
    Game.dt = 0.02
    const heights = []
    for (let step = 0; step < 220; step++) {
        wave.update()
        heights.push(wave.y)
    }
    assert.ok(wave.motionTime > 1, 'lateral steering finds room for the curve')
    assert.ok(Math.max(...heights) - Math.min(...heights) > 50)
})

test('incursions begin high, reserve one clear corridor and complete a deep descent and return', () => {
    const { Game, Enemy, app } = setup({ readyEnemies: false })
    Game.waveStage = 'wave'
    Game.pendingSpawns = []
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    Game.enemyIndex = 3
    const diver = new Enemy({ x: 100, y: 86 })
    diver.entering = false
    diver.shootInterval = 100000
    Game.resetEnemyMotion(diver)
    assert.equal(diver.pattern, 'diver')
    assert.ok(diver.entryY - diver.minY <= 8)
    Game.dt = 0.02
    const positions = []
    let descentX = null
    for (let step = 0; step < 200; step++) {
        diver.update()
        positions.push(diver.y)
        if (Game.incursion) {
            if (descentX === null) descentX = diver.x
            assert.equal(diver.x, descentX, 'the reserved descent stays in its corridor')
            const intruder = { width: 100, height: 60 }
            assert.equal(Game.canMoveEnemy(intruder, diver.x, diver.maxY), false)
        }
    }
    assert.ok(Math.max(...positions) - Math.min(...positions) >= 140, 'incursion is substantially deeper than a wave')
    assert.ok(Math.abs(diver.y - diver.homeY) < 1)
    assert.equal(Game.incursion, null, 'return releases the corridor')
    assert.ok(positions.every(y => y + diver.height <= Game.view.height * app.config.progression.incursionEnemyDepth + 0.000001))
})

test('incursion reservations wait for blockers, freeze during pause and clear on death, resize, boss and restart', () => {
    const { Game, Enemy, Boss, resize } = setup({ readyEnemies: false })
    Game.waveStage = 'wave'
    Game.pendingSpawns = []
    Game.difficulty = 4
    Game.configureEnemiesForTest()
    Game.enemyIndex = 3
    const diver = new Enemy({ x: 100, y: 86 })
    diver.entering = false
    const blocker = new Enemy({ x: 100, y: 170 })
    assert.equal(Game.reserveIncursion(diver), false)
    blocker.x = 400
    assert.equal(Game.reserveIncursion(diver), true)
    Game.enemyIndex = 7
    const other = new Enemy({ x: 600, y: 86 })
    other.entering = false
    assert.equal(Game.reserveIncursion(other), false)
    const reservation = Game.incursion
    Game.pause()
    Game.updateWorld(1)
    assert.equal(Game.incursion, reservation)
    assert.equal(diver.motionTime, 0)
    Game.unPause()
    diver.die()
    assert.equal(Game.incursion, null)
    assert.equal(Game.reserveIncursion(other), true)
    resize(360, 540)
    assert.equal(Game.incursion, null)
    Game.enemies = { [other.index]: other }
    assert.equal(Game.reserveIncursion(other), true)
    Game.spawnBossForTest()
    assert.equal(Game.incursion, null)
    Game.init()
    assert.equal(Game.incursion, null)
})

test('normal level advancement preserves live fan charges, roles and birth-level height limits', () => {
    const { Game, resize } = setup()
    const original = Game.enemies[0]
    Game.increaseDifficulty()
    assert.equal(original.profile.level, 1)
    resize(360, 540)
    assert.equal(original.maxY + original.height, Game.view.height * 0.3)
    Game.difficulty = 6
    Game.configureEnemiesForTest()
    Game.enemyAttackCooldown = 0
    assert.equal(original.shoot(), true)
    const charge = original.pendingAttack
    const profile = original.profile
    const refuge = Game.safeCorridor
    Game.increaseDifficulty()
    assert.equal(Game.difficulty, 7)
    assert.equal(original.profile, profile)
    assert.equal(original.role, 'controller')
    assert.equal(original.pendingAttack, charge)
    assert.equal(Game.safeCorridor, refuge)
    assert.equal(Game.waveProfile.level, 7)
})

test('a boss cannot bypass a live formation and restart cancels a pending encounter', () => {
    const { Game, Boss } = setup()
    assert.throws(() => new Boss(), /cleared field/)
    assert.equal(Game.boss, null)
    Game.difficulty = 4
    Game.applyWaveProfile()
    Game.increaseDifficulty()
    const remaining = Object.values(Game.enemies)
    assert.equal(Game.tryStartBoss(), false)
    Game.updateProgression(200)
    assert.equal(Game.difficulty, 5)
    assert.deepEqual(Object.values(Game.enemies), remaining)
    Game.init()
    Game.updateProgression(0)
    assert.equal(Game.waveStage, 'intro')
    assert.equal(Game.boss, null)
    assert.equal(Game.bossCount, 0)
})

test('boss attack phases change internally without phase labels or floating announcements', () => {
    const { Game, drawnTexts } = setup()
    const boss = Game.spawnBossForTest()
    boss.entering = false
    boss.y = 15
    for (const ratio of [1, 0.5, 0.2]) {
        boss.hp = Math.ceil(boss.maxHp * ratio)
        boss.updatePhase()
        boss.draw()
    }
    assert.equal(boss.phase, 3)
    assert.ok(drawnTexts.includes('JEFE'))
    assert.ok(!drawnTexts.some(text => text.includes('FASE')))
    assert.ok(!Object.values(Game.floatingTexts).some(text => text.text.includes('FASE')))
})

test('pause sound changes preserve the frozen session and collapse when continuing', () => {
    const { Game, document, controls, pauseMenu } = setup({ audioPanel: true })
    Game.pause()
    const sound = document.getElementById('audioSettings')
    sound.open = true
    const elapsed = Game.elapsedTime
    const music = controls.get('[data-music-volume]')
    music.value = '42'
    music.dispatch('input')
    assert.equal(Game.audio.volume, 0.42)
    assert.equal(Game.audio.paused, true)
    Game.updateWorld(1)
    assert.equal(Game.elapsedTime, elapsed)
    assert.equal(pauseMenu.open, true)
    Game.continued()
    assert.equal(pauseMenu.open, false)
    assert.equal(sound.open, false)
    assert.equal(Game.audio.volume, 0.42)
})

test('cached menu refreshes persisted pause sound settings without rebinding controls', () => {
    const storageValues = new Map()
    const { app, controls, listeners } = setup({ page: 'index.html', audioPanel: true, storageValues })
    assert.equal(app.settings.get().music, 0.3)
    storageValues.set('warInSpaceAudio', JSON.stringify({ music: 0.42, effects: 0.2, muted: true }))
    const count = listeners.get('pageshow').length
    for (let restore = 0; restore < 2; restore++) {
        for (const callback of listeners.get('pageshow')) callback({ persisted: true })
    }
    assert.equal(app.settings.get().music, 0.42)
    assert.equal(controls.get('[data-music-volume]').value, 42)
    assert.equal(controls.get('[data-effects-volume]').value, 20)
    assert.equal(controls.get('[data-mute]').attributes['aria-pressed'], 'true')
    assert.equal(listeners.get('pageshow').length, count)
})

test('keyboard Enter restarts Game Over once and cannot repeatedly restart a live game', () => {
    const { Game, frames } = setup()
    Game.gameOver()
    let prevented = 0
    Game.buttonDown({ key: 'Enter', repeat: false, preventDefault() { prevented++ } })
    assert.equal(prevented, 1)
    assert.equal(Game.isGameOver, false)
    assert.equal(Game.waveStage, 'intro')
    assert.equal(frames.size, 1)
    const player = Game.player
    Game.buttonDown({ key: 'Enter', repeat: true, preventDefault() {} })
    Game.buttonDown({ key: 'Enter', repeat: false, preventDefault() {} })
    assert.equal(Game.player, player)
    assert.equal(frames.size, 1)
})

test('restarts reuse video, audio and sprite resources without multiplying animation loops', () => {
    const { Game, frames } = setup({ synthAudio: true })
    const resources = [Game.video, Game.audio, Game.sfxLaser, Game.sfxExplosion, Game.audioCtx, Game.effectsGain]
    for (let restart = 0; restart < 4; restart++) {
        Game.init()
        assert.deepEqual([Game.video, Game.audio, Game.sfxLaser, Game.sfxExplosion, Game.audioCtx, Game.effectsGain], resources)
        assert.equal(frames.size, 1)
    }
})

test('an out-of-order animation timestamp cannot reverse simulation time', () => {
    const { Game, frame, frames } = setup()
    frame(32)
    const elapsed = Game.elapsedTime
    frame(16)
    assert.equal(Game.dt, 0)
    assert.equal(Game.elapsedTime, elapsed)
    assert.equal(frames.size, 1)
})

test('an announced fan reserves enough projectile slots to fire at the density limit', () => {
    const { Game, app } = setup()
    Game.difficulty = 6
    Game.configureEnemiesForTest()
    const enemy = Game.enemies[0]
    enemy.salvo = 1
    assert.equal(enemy.shoot(), true)
    for (let i = 0; i < app.config.progression.maxEnemyBullets - 4; i++) {
        assert.equal(Game.fireEnemyVolley(20, 100, 3, 'lime', [0]).length, 1)
    }
    assert.equal(Game.fireEnemyVolley(20, 100, 3, 'lime', [0]).length, 0)
    Game.dt = 0.8
    enemy.update()
    assert.equal(Object.keys(Game.enemyBullets).length, app.config.progression.maxEnemyBullets)
    assert.equal(Object.values(Game.enemyBullets).filter(bullet => bullet.isFan).length, 4)
    assert.equal(Game.safeCorridor.fired, true)
})

