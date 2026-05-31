#!/usr/bin/env node
/* One-time migration — seed existing notes with `created` / `updated` frontmatter.
 *
 * Why: dates currently come from filesystem birthtime/mtime, which aren't durable
 * (copies/syncs corrupt birthtime; a git clone resets everything to checkout time).
 * The Obsidian "Update time on edit" plugin maintains created/updated frontmatter
 * going forward — but it would stamp the *existing* notes with today's date. This
 * script captures their real current file dates into frontmatter first, so history
 * is preserved before the plugin takes over.
 *
 * Idempotent: skips any note that already has a `created:` key.
 *
 * Usage:  node scripts/backfill-frontmatter.js            (defaults to ~/Fruits/2-Notes)
 *         NOTES_DIR=/path node scripts/backfill-frontmatter.js
 *         node scripts/backfill-frontmatter.js --dry-run  (preview, writes nothing)
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const SRC = process.env.NOTES_DIR || path.join(os.homedir(), "Fruits", "2-Notes");
const DRY = process.argv.includes("--dry-run");

const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

// has a leading frontmatter block at all?
const hasFrontmatter = (raw) => /^---[ \t]*\r?\n/.test(raw);

// does that block already declare created:?
const hasCreated = (raw) => {
  const m = raw.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---/);
  return m ? /^created:/m.test(m[1]) : false;
};

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source folder not found: ${SRC}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(SRC)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort();

  let changed = 0;
  let skipped = 0;

  for (const file of files) {
    const full = path.join(SRC, file);
    const raw = stripBom(fs.readFileSync(full, "utf8"));

    if (hasCreated(raw)) {
      skipped++;
      continue;
    }

    const st = fs.statSync(full);
    const mtime = st.mtime;
    const birth =
      st.birthtime && st.birthtime.getFullYear() > 1971 ? st.birthtime : mtime;
    const planted = birth <= mtime ? birth : mtime; // clamp (see build.js)
    const created = fmtDate(planted);
    const updated = fmtDate(mtime);

    let out;
    if (hasFrontmatter(raw)) {
      // insert created/updated right after the opening --- of the existing block
      out = raw.replace(
        /^(---[ \t]*\r?\n)/,
        `$1created: ${created}\nupdated: ${updated}\n`
      );
    } else {
      out = `---\ncreated: ${created}\nupdated: ${updated}\n---\n\n${raw.replace(/^\s+/, "")}`;
    }

    if (DRY) {
      console.log(`would update  ${file}  (created ${created} · updated ${updated})`);
    } else {
      fs.writeFileSync(full, out);
      console.log(`updated       ${file}  (created ${created} · updated ${updated})`);
    }
    changed++;
  }

  console.log(
    `\n${DRY ? "[dry run] " : ""}${changed} updated · ${skipped} already had created:`
  );
}

main();
