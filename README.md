# Working Notes

A lightweight static site for my evergreen/working notes — a garden of small,
interlinked notes that **stack horizontally** as you follow links (à la Andy
Matuschak), with growth-stage status, backlinks, hover previews, dark mode, and
status filtering.

Built from the **Stacked** design (`claude.ai/design` handoff). Plain
HTML/CSS/JS — no framework.

## Files

| File         | What it is                                                            |
|--------------|-----------------------------------------------------------------------|
| `index.html` | The shell                                                             |
| `styles.css` | All styling (verbatim from the design + additions for real content)   |
| `app.js`     | Stacking / navigation / theme / preview logic                         |
| `build.js`   | Dev-time generator: reads your notes → emits `notes.js`               |
| `notes.js`   | **Generated** — note data + helpers. Do not edit by hand.             |
| `status.json`| **Optional** — curate each note's growth stage (see below)            |

## Build & run

```bash
node build.js                 # reads ~/Fruits/2-Notes, writes notes.js
NOTES_DIR=/some/other/dir node build.js   # use a different source folder

# serve (any static server works):
python3 -m http.server 8137   # then open http://localhost:8137
```

Opening `index.html` directly via `file://` also works (fonts need a connection).

## Navigating & sharing

- Click a note, then follow its links — they **stack to the right** without a page reload.
- The open stack is reflected in the URL (`?stack=note-a,note-b,…`), so any view is
  **bookmarkable and shareable**, and the browser **back/forward** buttons step through it.
- Everything is keyboard-navigable (links are real `<a>`/buttons with focus rings);
  ⌘/Ctrl-click a link to open that note standalone in a new tab.

## How notes are ingested

Source: the markdown files in `~/Fruits/2-Notes` (one note per `.md` file).
Re-run `node build.js` whenever you add or edit notes.

- **Title** = the filename (your filenames are already claim-style titles).
- **Body** = markdown → HTML (paragraphs, nested lists, headings, bold/italic,
  inline + fenced code, standard links).
- **`[[wikilinks]]`** that point to another note **in this folder** become
  clickable stacking links; links to notes **outside** the folder render as
  **plain text** (no dead links). `[[Target|alias]]` is supported.
- **Obsidian image embeds** (`![[…png]]`) show a faint `[image: …]` placeholder,
  since attachments live outside the notes folder.

## Metadata the design needs (and where it comes from)

Your notes have no front-matter, so two fields are **derived** at build time:

- **Dates** — `planted` = file creation time, `tended` = file modified time.
  "Recently tended" sorts the directory by `tended`.
- **Status** (`seedling → budding → evergreen`) — derived from how densely a note
  is linked *within this folder*: orphan → seedling, connected → budding, hub
  (≥4 links) → evergreen.

### Curating status

The heuristic is just a starting point. To pin a note's stage, add it to
`status.json` (keyed by note title **or** slug) — overrides win over the
heuristic and survive rebuilds:

```json
{
  "Model Context Protocol": "evergreen",
  "CAP theorem": "budding"
}
```
# working-notes
