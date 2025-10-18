import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, 'src/pages');

// Very conservative TypeScript cleanup
function cleanupTypeScript(content) {
  let result = content;
  
  // Remove 'as const' assertions
  result = result.replace(/\s+as\s+const/g, '');
  
  // Remove type annotations from event handlers: (e: React.FormEvent)
  result = result.replace(/\(e:\s*React\.FormEvent[^)]*\)/g, '(e)');
  
  // Remove simple type annotations from params: (param: string)
  result = result.replace(/\(([a-z][a-zA-Z0-9]*)\s*:\s*string\)/g, '($1)');
  result = result.replace(/\(([a-z][a-zA-Z0-9]*)\s*:\s*number\)/g, '($1)');
  
  // Remove Date | undefined type annotations
  result = result.replace(/:\s*Date\s*\|\s*undefined/g, '');
  
  // Update imports from .tsx to .jsx
  result = result.replace(/from\s+(['"].*?)\.tsx(['"'])/g, 'from $1.jsx$2');
  
  return result;
}

// Process each .tsx file in pages directory
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

console.log(`Found ${files.length} .tsx files in pages directory\n`);

files.forEach(file => {
  const tsxPath = path.join(pagesDir, file);
  const jsxPath = path.join(pagesDir, file.replace('.tsx', '.jsx'));
  
  console.log(`Converting: ${file}`);
  
  const content = fs.readFileSync(tsxPath, 'utf8');
  const cleaned = cleanupTypeScript(content);
  
  fs.writeFileSync(jsxPath, cleaned, 'utf8');
  fs.unlinkSync(tsxPath);
  
  console.log(`  ✅ Created: ${file.replace('.tsx', '.jsx')}\n`);
});

console.log('✨ Done!');
