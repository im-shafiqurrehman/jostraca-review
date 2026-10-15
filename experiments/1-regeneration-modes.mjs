// Hands-on checks of jostraca 0.39.0 regeneration behaviour.
import { readFileSync, appendFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs'
import { Jostraca, Project, File, Content } from 'jostraca'

const show = (label, path) => console.log(`--- ${label}: ${path}\n` + (existsSync(path) ? readFileSync(path, 'utf8') : '(missing)\n'))
const gen = (opts, files) => Jostraca(opts).generate({ folder: './out' }, () => {
  Project({}, () => { for (const [n, b] of Object.entries(files)) File({ name: n }, () => Content(b)) })
})
const fresh = () => rmSync('./out', { recursive: true, force: true })

// 1. Default mode: a hand edit, then regenerate.
fresh()
await gen({}, { 'README.md': '# Generated\n' })
writeFileSync('./out/README.md', '# My own README\nWritten by hand.\n')
const r1 = await gen({}, { 'README.md': '# Generated\n' })
show('1 default mode, after regenerate', './out/README.md')

// 2. Merge mode, hand edit on the SAME line the generator changes.
fresh()
const merge = { existing: { txt: { write: true, merge: true } } }
await gen(merge, { 'config.sh': 'PORT=8080\nHOST=localhost\n' })
writeFileSync('./out/config.sh', 'PORT=7000\nHOST=localhost\n')
await gen(merge, { 'config.sh': 'PORT=9090\nHOST=localhost\n' })
show('2 merge mode, conflicting edit', './out/config.sh')

// 3. Merge mode, but the saved base copy is gone (fresh clone without .jostraca/generated).
fresh()
await gen(merge, { 'config.sh': 'PORT=8080\nHOST=localhost\n' })
appendFileSync('./out/config.sh', 'DEBUG=1\n')
console.log('base copy files before delete:', existsSync('./out/.jostraca') ? readdirSync('./out/.jostraca') : 'none')
rmSync('./out/.jostraca', { recursive: true, force: true })
await gen(merge, { 'config.sh': 'PORT=9090\nHOST=localhost\n' })
show('3 merge mode, base copy deleted', './out/config.sh')

// 4. JOSTRACA_PROTECT marker in default mode.
fresh()
await gen({}, { 'README.md': '# Generated\n' })
writeFileSync('./out/README.md', '<!-- JOSTRACA_PROTECT -->\n# My own README\n')
await gen({}, { 'README.md': '# Generated v2\n' })
show('4 protected file, after regenerate', './out/README.md')

// 5. Generator stops emitting a file.
fresh()
await gen({}, { 'a.txt': 'a\n', 'old.txt': 'old\n' })
await gen({}, { 'a.txt': 'a\n' })
console.log('--- 5 after dropping old.txt from the generator, out/ has:', readdirSync('./out').filter(f => !f.startsWith('.')))
console.log('result keys from a generate() call:', Object.keys(r1 || {}))
