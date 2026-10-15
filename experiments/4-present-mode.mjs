// Does `present` keep a hand edit and put the new version beside it? And does it need write:false?
import { writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { Jostraca, Project, File, Content } from 'jostraca'
for (const [label, existing] of [
  ['present:true, write:false', { txt: { write: false, present: true } }],
  ['present:true, write left at default', { txt: { present: true } }],
]) {
  rmSync('./out', { recursive: true, force: true })
  const run = (body) => Jostraca({ existing }).generate({ folder: './out' }, () =>
    Project({}, () => File({ name: 'README.md' }, () => Content(body))))
  await run('# Generated v1\n')
  writeFileSync('./out/README.md', '# My own README\n')
  const r = await run('# Generated v2\n')
  const files = readdirSync('./out').filter((f) => !f.startsWith('.'))
  console.log(`${label}:`)
  console.log('  files:', files.join(', '))
  for (const f of files) console.log(`  ${f}: ${JSON.stringify(readFileSync('./out/' + f, 'utf8'))}`)
  console.log('  result:', JSON.stringify(Object.fromEntries(Object.entries(r.files).filter(([, v]) => v.length))))
}
