'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'dist']);
const LINK_RE = /!\[[^\]]*\]\(([^)]+)\)|\[[^\]]*\]\(([^)]+)\)|<(?:img|script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(md|html|htm)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

describe('link checker (package tree)', () => {
  it('every relative markdown/html link and image resolves on disk', () => {
    const files = walk(root);
    const broken = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      let m;
      const re = new RegExp(LINK_RE.source, 'gi');
      while ((m = re.exec(text))) {
        const raw = (m[1] || m[2] || m[3] || '').trim();
        if (!raw || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw) || raw.startsWith('//')) continue;
        const rel = raw.split('#')[0].split('?')[0];
        if (!rel) continue;
        const target = path.resolve(path.dirname(file), rel);
        if (!fs.existsSync(target)) {
          broken.push({ file: path.relative(root, file), link: raw });
        }
      }
    }
    assert.equal(broken.length, 0, JSON.stringify(broken, null, 2));
    assert.ok(files.length > 5);
  });
});
