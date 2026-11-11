#!/usr/bin/env node
'use strict';
/**
 * Verify relative links/images in .md and .html resolve on disk.
 * Usage: node scripts/check-links.js [rootDir]
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist']);
const LINK_RE = /!\[[^\]]*\]\(([^)]+)\)|\[[^\]]*\]\(([^)]+)\)|<(?:img|script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(md|html|htm)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

function stripHashQuery(u) {
  return u.split('#')[0].split('?')[0];
}

function isExternal(u) {
  return /^(https?:|mailto:|tel:|data:|javascript:)/i.test(u);
}

function checkFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const broken = [];
  let m;
  const re = new RegExp(LINK_RE.source, 'gi');
  while ((m = re.exec(text))) {
    const raw = (m[1] || m[2] || m[3] || '').trim();
    if (!raw || isExternal(raw) || raw.startsWith('//')) continue;
    const rel = stripHashQuery(raw);
    if (!rel) continue; // pure hash
    const target = path.resolve(path.dirname(file), rel);
    if (!fs.existsSync(target)) {
      broken.push({ file: path.relative(root, file), link: raw, resolved: path.relative(root, target) });
    }
  }
  return broken;
}

function main() {
  const files = walk(root);
  let broken = [];
  for (const f of files) broken = broken.concat(checkFile(f));
  const report = { root, filesChecked: files.length, broken: broken.length, details: broken };
  console.log(JSON.stringify(report, null, 2));
  if (broken.length) process.exitCode = 1;
  return report;
}

if (require.main === module) main();
module.exports = { main, checkFile, walk };
