# Experiments behind the article

Tested with jostraca 0.39.0 on Node 22 and Node 24.

```bash
npm install
node 1-regeneration-modes.mjs   # default overwrite, merge conflict, missing base, JOSTRACA_PROTECT, stale files
node 2-fresh-clone.mjs          # merge after git clone, with and without control.version
node 3-article-snippets.mjs     # the article's code examples, run as printed
node 4-present-mode.mjs         # present mode, with and without write: false
```

Each script writes into folders it creates here (`out/`, `repo-*`, `clone-*`).
