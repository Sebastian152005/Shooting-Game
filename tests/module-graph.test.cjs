const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const root = path.resolve(__dirname, '..')
const importPattern = /^\s*import\s+(['"])([^'"]+)\1\s*;?\s*$/gm

const graphs = {
    'src/js/bootstrap/game-entry.js': {
        bootstrap: './game.js',
        imports: [
            '../config.js',
            '../infrastructure/assets.js',
            '../infrastructure/browser.js',
            '../domain/geometry.js',
            '../domain/formation.js',
            '../domain/collision.js',
            '../domain/motion.js',
            '../domain/targeting.js',
            '../domain/combat-intensity.js',
            '../domain/progression.js',
            '../domain/enemy-archetypes.js',
            '../domain/enemy-ai.js',
            '../domain/boss-attacks.js',
            '../domain/wave-state.js',
            '../domain/energy.js',
            '../domain/hazards.js',
            '../domain/player-progress.js',
            '../infrastructure/storage.js',
            '../application/settings.js',
            '../application/input-state.js',
            '../presentation/ui/settings.js',
            '../application/session-state.js',
            '../application/game.js',
            '../application/progression.js',
            '../application/spawning.js',
            '../application/movement.js',
            '../application/simulation.js',
            '../application/attacks.js',
            '../application/energy.js',
            '../application/rewards.js',
            '../application/world-events.js',
            '../presentation/viewport.js',
            '../infrastructure/input.js',
            '../infrastructure/audio.js',
            '../presentation/ui/hud.js',
            '../presentation/ui/scene.js',
            '../presentation/ui/entities.js',
            '../presentation/ui/progression-features.js',
            '../presentation/ui/reward-dialog.js',
            '../application/entities/player.js',
            '../application/entities/bullet.js',
            '../application/entities/enemy.js',
            '../application/entities/boss.js',
            '../application/entities/enemy-bullet.js',
            '../application/entities/particle.js',
            '../application/entities/power-up.js',
            '../application/entities/energy-pickup.js',
            '../application/entities/meteor.js',
            '../application/entities/floating-text.js',
            './game.js'
        ]
    },
    'src/js/bootstrap/menu-entry.js': {
        bootstrap: './menu.js',
        imports: [
            '../config.js',
            '../domain/player-progress.js',
            '../infrastructure/storage.js',
            '../application/settings.js',
            '../presentation/ui/settings.js',
            './menu.js'
        ]
    }
}

function readSideEffectImports(file) {
    const source = fs.readFileSync(file, 'utf8')
    const imports = [...source.matchAll(importPattern)].map(match => match[2])
    const executableRemainder = source
        .replace(importPattern, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .trim()
    assert.equal(executableRemainder, '', path.relative(root, file) + ' must remain a declarative side-effect manifest')
    return imports
}

for (const [entryPath, graph] of Object.entries(graphs)) {
    test(entryPath + ' declares a valid ordered ESM dependency graph', () => {
        const entry = path.resolve(root, entryPath)
        const imports = readSideEffectImports(entry)

        assert.deepEqual(imports, graph.imports)
        assert.equal(new Set(imports).size, imports.length, 'imports must not be duplicated')
        assert.equal(imports[0], '../config.js', 'configuration must initialize the namespace first')
        assert.equal(imports.at(-1), graph.bootstrap, 'legacy bootstrap must compose the graph last')

        for (const specifier of imports) {
            assert.ok(specifier.startsWith('./') || specifier.startsWith('../'), 'only local modules are allowed: ' + specifier)
            const dependency = path.resolve(path.dirname(entry), specifier)
            assert.ok(fs.existsSync(dependency), entryPath + ' imports missing module ' + specifier)
            assert.equal(path.extname(dependency), '.js', entryPath + ' must import JavaScript modules')
        }
    })
}
