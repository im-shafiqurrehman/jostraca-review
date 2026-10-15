// Runs the article's JavaScript snippets as printed (with the imports they need).
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { Jostraca, Project, Folder, File, Content } from 'jostraca'

// Snippet 1: the component tree.
await Jostraca().generate({ folder: './out' }, () => {
  Project({}, () => {
    Folder({ name: 'src' }, () => {
      File({ name: 'index.js' }, () => Content('console.log("hi")\n'))
    })
  })
})
console.log('snippet 1 -> out/src/index.js:', JSON.stringify(readFileSync('./out/src/index.js', 'utf8')))

// Snippet 2: default mode overwrites a hand edit.
const run = () => Jostraca().generate({ folder: './out' }, () =>
  Project({}, () => File({ name: 'README.md' }, () => Content('# Generated\n'))))

await run()
writeFileSync('./out/README.md', '# My own README\n')
await run()
console.log('snippet 2 -> out/README.md:', JSON.stringify(readFileSync('./out/README.md', 'utf8')))

// Snippet 3 + guard: merge config, conflicting edit, then the article's check.
const jostraca = Jostraca({ existing: { txt: { write: true, merge: true } } })
const root = (port) => () => Project({}, () => File({ name: 'config.sh' }, () => Content(`PORT=${port}\nHOST=localhost\n`)))
await jostraca.generate({ folder: './out' }, root(8080))
writeFileSync('./out/config.sh', 'PORT=7000\nHOST=localhost\n')
try {
  const result = await jostraca.generate({ folder: './out' }, root(9090))
  if (result.files.conflicted.length > 0) {
    throw new Error('Merge conflicts: ' + result.files.conflicted.join(', '))
  }
  console.log('guard -> no conflict (unexpected)')
} catch (e) { console.log('guard ->', e.message) }

// Snippet 4: the protect marker.
writeFileSync('./out/README.md', '<!-- JOSTRACA_PROTECT -->\n# My own README\n')
await run()
console.log('protect -> out/README.md:', JSON.stringify(readFileSync('./out/README.md', 'utf8')))
