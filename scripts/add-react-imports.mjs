import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

let updated = 0;

function needsReactImport(code) {
  if (!code.includes('React.createElement')) return false;
  if (/import\s+React\s+from\s+['"]react['"];?/.test(code)) return false;
  if (/import\s+\*\s+as\s+React\s+from\s+['"]react['"];?/.test(code)) return false;
  return true;
}

function addImport(code) {
  const importLine = "import React from 'react';\n";
  // If sucrase injected _jsxFileName at very top, place after it
  if (code.startsWith('const _jsxFileName')) {
    const firstImportIndex = code.indexOf('import ');
    if (firstImportIndex > -1) {
      return code.slice(0, firstImportIndex) + importLine + code.slice(firstImportIndex);
    }
    return code.replace(/^const _jsxFileName.*\n/, match => match + importLine);
  }
  // Otherwise, put at top
  return importLine + code;
}

walk(srcDir, (file) => {
  if (!file.endsWith('.jsx')) return;
  const code = fs.readFileSync(file, 'utf8');
  if (needsReactImport(code)) {
    const newCode = addImport(code);
    fs.writeFileSync(file, newCode, 'utf8');
    console.log(`+ Added React import: ${path.relative(root, file)}`);
    updated++;
  }
});

console.log(`Updated ${updated} files.`);
