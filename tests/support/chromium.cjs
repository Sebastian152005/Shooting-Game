const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_BROWSER_PATHS = Object.freeze([
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
])

function findBrowserExecutable(environment = process.env, exists = fs.existsSync) {
    return [environment.CHROME_PATH, ...DEFAULT_BROWSER_PATHS]
        .find(candidate => candidate && exists(candidate))
}

function browserArguments(profile, width = 1280, height = 720) {
    if (!path.isAbsolute(profile)) throw Error('Chromium profile path must be absolute')
    return [
        '--headless=new',
        '--disable-background-networking',
        // Headless rendering does not need Graphite. Disabling it also avoids
        // Dawn's persistent GPU cache, which can be unavailable in sandboxes.
        '--disable-skia-graphite',
        '--disable-features=SkiaGraphiteUsePersistentCache,GpuPersistentCache',
        '--no-first-run',
        '--no-default-browser-check',
        '--remote-debugging-port=0',
        '--user-data-dir=' + profile,
        `--window-size=${width},${height}`,
        'about:blank'
    ]
}

function browserDiagnostics(stderr) {
    const tail = stderr.slice(-1800)
    if (/DawnGraphiteCache/.test(stderr) && /GPU process isn't usable/.test(stderr)) {
        return 'Chromium could not initialize its Dawn/Graphite cache. ' +
            'The failure happened before the game page loaded.\n' + tail
    }
    return tail
}

module.exports = { browserArguments, browserDiagnostics, findBrowserExecutable }
