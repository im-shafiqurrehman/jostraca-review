# Jostraca runs twice, but only on your machine

This week I lost a README to a code generator. I was building [an SDK for the Finnhub stock market API](https://github.com/im-shafiqurrehman/finnhub-sdk) with the Voxgig SDK generator. I wrote my own `README.md` at the root of the project, ran `npm run generate` again, and my file was replaced by the generated one. There was no message, no backup and no prompt.

The library that wrote that file is [Jostraca](https://jostraca.org/), whose homepage title is "A code generator you can run twice". I tested that claim on jostraca 0.39.0 with Node 22 and 24. The scripts are in the [experiments](experiments/) folder.

## What Jostraca gets right

Jostraca has no template language. A file tree is a set of nested function calls:

```js
import { Jostraca, Project, Folder, File, Content } from 'jostraca'

await Jostraca().generate({ folder: './out' }, () => {
  Project({}, () => {
    Folder({ name: 'src' }, () => {
      File({ name: 'index.js' }, () => Content('console.log("hi")\n'))
    })
  })
})
```

Loops are `for`, branches are `if`, and the debugger and type checker work as normal. `Fragment` templates stay valid HTML, Go or SQL, so editors and linters still understand them. I prefer this to Handlebars or Jinja, where the template is a second language with its own bugs.

I also like the two-phase build: Jostraca computes every file first, then decides what to do with each existing one. That is what makes its five modes possible: write, preserve, present, diff and merge. Its documentation examples run in the test suite, and the TypeScript and Go versions share one test corpus.

## The default is still overwrite

The default mode is `write`, and it overwrites. So the first thing a new user meets is the behaviour the project says it exists to fix:

```js
const run = () => Jostraca().generate({ folder: './out' }, () =>
  Project({}, () => File({ name: 'README.md' }, () => Content('# Generated\n'))))

await run()
writeFileSync('./out/README.md', '# My own README\n')
await run()
// out/README.md is "# Generated" again
```

There is a way out. Any file that contains the string `JOSTRACA_PROTECT` is never touched:

```md
<!-- JOSTRACA_PROTECT -->
# My own README
```

It works. The SDK generator's repository mentions the marker in two pages, but the guides inside a generated project do not, and the generated root guide even claims that `generate` merges into existing files. I found the marker after losing the file. Nobody should need the docs of a library they did not know they were using to keep their own README.

The `present` mode, which keeps your file and writes the new version beside it as `README.new.md`, has a trap. `write` is checked first, so `present: true` on its own still overwrites:

```js
Jostraca({ existing: { txt: { present: true } } })               // README.md overwritten
Jostraca({ existing: { txt: { write: false, present: true } } }) // README.md kept, README.new.md written
```

The explanation page says `present` needs `write: false`, but the library accepts the first form without a word. An option combination that cannot take effect should be an error.

## Merge works on one machine

Enable merge and the second run behaves as promised. When my edit and the generator's change touch the same line, Jostraca writes conflict markers into the file:

```js
const jostraca = Jostraca({ existing: { txt: { write: true, merge: true } } })
```

```text
<<<<<<< GENERATED: 2026-10-15T08:54:44.611Z/merge
PORT=9090
=======
PORT=7000
>>>>>>> EXISTING: 2026-10-15T08:54:44.610Z/merge
HOST=localhost
```

Nothing is printed. The conflict appears only in the return value, under `result.files.conflicted`, so unless your script checks it, you find out when the build breaks. I would add this guard to every generator that uses merge:

```js
const result = await jostraca.generate({ folder: './out' }, root)
if (result.files.conflicted.length > 0) {
  throw new Error('Merge conflicts: ' + result.files.conflicted.join(', '))
}
```

## The merge base is gitignored

A three-way merge needs a base, the version both sides started from. Jostraca keeps a copy of the last generated output in `.jostraca/generated/`, and it writes a `.jostraca/.gitignore` that excludes that folder. So the base never reaches git.

I committed a generated file with a hand edit (`DEBUG=1`), cloned the repository and regenerated in the clone, with and without the `control.version` option:

```text
control.version: false (default)  result: written  file: PORT=9090, HOST=localhost
control.version: true             result: merged   file: PORT=9090, HOST=localhost, DEBUG=1
```

With the default, the hand edit is gone, and the result lists the file as `written`, like any normal write. The [options reference](https://jostraca.org/docs/reference-options) says this directly: without a baseline, "the file is overwritten instead", with "no error, no warning". The [explanation page](https://jostraca.org/docs/explanation) describes the same case as degrading "to a two-way comparison", which does not match what I saw.

The explanation page calls this default "the arguable one" and offers the switch: `control.version: true` stops the `.gitignore` from being written. I would argue harder. A fresh clone is the normal case: a teammate's laptop, a CI runner, a new machine. A library built for the second run should not lose edits on all of them by default, and it should at least warn when merge falls back to overwrite. The option name does not help: `version` means "keep `.jostraca` under version control", which I only understood from its description.

## The generator I used turned merge off

The Voxgig SDK generator is built on Jostraca, and every project it scaffolds runs it like this:

```js
existing: { txt: { write: true, merge: false } },
```

Its maintainers explain why in a [decision record](https://github.com/voxgig/sdkgen/blob/main/docs/explanation/regeneration-overwrite.md). The generator once enabled merge for every file. During toolchain upgrades, merge kept stale files, wrote conflict markers into files the next tool could not parse, and sometimes skipped template changes, while generation still exited with success. Now generated folders are disposable and edits belong in the model.

For SDK code that is a sensible rule, and it is also how my README was lost. Jostraca's own explanation page lists "generate into a directory nobody may touch" as one of the ways teams avoid the second-run problem instead of solving it. The project I met Jostraca through tried merge first, then took that route.

Stale files are a related gap. When I removed `old.txt` from a generator and ran it again, Jostraca left the old file on disk. The SDK generator handles this itself: it records every file each run writes in `.sdk/log/generated.jsonl` and deletes the ones a component no longer produces.

## How other tools handle the base

Copier, a Python project template tool, records the template source and version in a committed `.copier-answers.yml`. [`copier update`](https://copier.readthedocs.io/en/stable/updating/) rebuilds the old output from that version and uses it as the merge base, so any clone can update. Jostraca stores the base as a cache and excludes it from git. [Yeoman](https://yeoman.io/) takes a simpler route and asks about each file that would change.

Jostraca cannot copy Copier exactly, because its input is code and a model, not a versioned template. Committing the base by default would get most of the way there.

## What I would change

- Commit the merge base by default, or print a warning each time a merge falls back to overwrite.
- Print conflicted files at the end of a run, and give callers a simple way to fail on them.
- Reject option combinations that cannot take effect, such as `present: true` with `write` still on.
- Report or remove files that the generator no longer produces.
- Use a default that keeps edits for text files, such as `present`, since regeneration is the reason to pick this library.

For generated code that nobody edits by hand, I would use it. The API is pleasant, the output is deterministic, and the two-phase build is a sound design. For files people are expected to edit, I would enable `merge` and `control.version`, add the conflict check above, and test the process from a fresh clone before trusting it with anyone's work.
