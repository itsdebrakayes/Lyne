import fs from 'fs';
import path from 'path';
import { transform } from 'sucrase';
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

const files = [];
walk(srcDir, (f) => { if (f.endsWith('.tsx')) files.push(f); });

console.log(`Found ${files.length} TSX files`);

for (const tsx of files) {
  const code = fs.readFileSync(tsx, 'utf8');
  const { code: jsx } = transform(code, { transforms: ['typescript', 'jsx'] });
  const out = tsx.replace(/\.tsx$/, '.jsx');
  fs.writeFileSync(out, jsx, 'utf8');
  fs.unlinkSync(tsx);
  console.log(`→ ${path.relative(root, tsx)} -> ${path.relative(root, out)}`);
}

// Update imports that explicitly reference .tsx
function updateImports(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  const updated = text.replace(/from (['"].*?)\.tsx(['"])/g, 'from $1.jsx$2');
  if (updated !== text) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`• Updated imports in ${path.relative(root, filePath)}`);
  }
}

walk(srcDir, (f) => { if (f.endsWith('.jsx') || f.endsWith('.js')) updateImports(f); });

// Update index.html entry point
const indexHtml = path.join(root, 'index.html');
if (fs.existsSync(indexHtml)) {
  const html = fs.readFileSync(indexHtml, 'utf8');
  const out = html.replace('/src/main.tsx', '/src/main.jsx');
  if (out !== html) {
    fs.writeFileSync(indexHtml, out, 'utf8');
    console.log('• Updated index.html entry');
  }
}

console.log('Done.');
