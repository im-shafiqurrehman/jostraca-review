// Fresh-clone test: with and without control.version, via a real git commit + clone.
import { execSync } from 'node:child_process'
import { appendFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { Jostraca, Project, File, Content } from 'jostraca'
const sh = (c, cwd) => execSync(c, { cwd, stdio: 'pipe' }).toString()
for (const version of [false, true]) {
  const repo = `./repo-${version}`, clone = `./clone-${version}`
  rmSync(repo, { recursive: true, force: true }); rmSync(clone, { recursive: true, force: true })
  const opts = { existing: { txt: { write: true, merge: true } }, control: { version } }
  const gen = (folder, body) => Jostraca(opts).generate({ folder }, () => Project({}, () => File({ name: 'config.sh' }, () => Content(body))))
  await gen(repo, 'PORT=8080\nHOST=localhost\n')
  appendFileSync(`${repo}/config.sh`, 'DEBUG=1\n')
  sh('git init -q && git add -A && git -c user.name=t -c user.email=t@t commit -qm init', repo)
  sh(`git clone -q ${repo} ${clone}`, '.')
  const r = await gen(clone, 'PORT=9090\nHOST=localhost\n')
  console.log(`control.version=${version}: base committed=${existsSync(clone + '/.jostraca/generated/config.sh')} | result=${JSON.stringify(Object.fromEntries(Object.entries(r.files).filter(([, v]) => v.length)))} | file=${JSON.stringify(readFileSync(clone + '/config.sh', 'utf8'))}`)
}
