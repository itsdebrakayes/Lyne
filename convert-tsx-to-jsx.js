import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');

// Minimal TypeScript removal - only remove what's absolutely necessary
function cleanTypeScript(content) {
  let modified = content;

  // Remove import type statements
  modified = modified.replace(/^import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm, '');
  
  // Remove standalone interface declarations (but be careful with embedded ones)
  modified = modified.replace(/^interface\s+\w+\s*\{[^}]*\}\s*$/gm, '');
  
  // Remove standalone type declarations
  modified = modified.replace(/^type\s+\w+\s*=\s*[^;]+;\s*$/gm, '');
  
  // Remove React.FC type annotations
  modified = modified.replace(/:\s*React\.FC(<[^>]*>)?/g, '');
  modified = modified.replace(/:\s*FC(<[^>]*>)?/g, '');
  
  // Remove : Type from function parameters with destructuring
  // Pattern: ({ param1, param2, ... }: TypeName) => ({ param1, param2, ... }) =>
  modified = modified.replace(/\((\{[^}]+\})\s*:\s*\w+\)/g, '($1)');
  
  // Remove return type annotations from arrow functions
  // Pattern: ): Type => or ): Type {
  modified = modified.replace(/\)\s*:\s*[A-Z]\w*(<[^>]*>)?\s*=>/g, ') =>');
  modified = modified.replace(/\)\s*:\s*[A-Z]\w*(<[^>]*>)?\s*\{/g, ') {');
  modified = modified.replace(/\)\s*:\s*[a-z]\w*\[\]\s*=>/g, ') =>');
  modified = modified.replace(/\)\s*:\s*void\s*=>/g, ') =>');
  modified = modified.replace(/\)\s*:\s*JSX\.Element\s*=>/g, ') =>');
  
  // Remove type assertions like 'as Type' or 'as const'
  modified = modified.replace(/\s+as\s+[A-Z]\w*(<[^>]*>)?/g, '');
  modified = modified.replace(/\s+as\s+const/g, '');
  modified = modified.replace(/\s+as\s+string/g, '');
  modified = modified.replace(/\s+as\s+number/g, '');
  modified = modified.replace(/\s+as\s+any/g, '');
  modified = modified.replace(/\s+as\s+Date\s*\|\s*undefined/g, '');
  
  // Remove non-null assertion operator (!) but be careful
  modified = modified.replace(/getElementById\("root"\)!/g, 'getElementById("root")');
  modified = modified.replace(/\.value!/g, '.value');
  
  // Remove optional property markers in object type definitions
  // But be careful not to break actual code
  modified = modified.replace(/(\w+)\?:\s*([A-Z]\w*|string|number|boolean)/g, '$1');
  
  // Clean up extra blank lines
  modified = modified.replace(/\n\n\n+/g, '\n\n');
  
  return modified;
}

// Update all imports to use .jsx instead of .tsx
function updateImports(content) {
  return content.replace(/from\s+(['"].*?)\.tsx(['"'])/g, 'from $1.jsx$2');
}

// Find all .tsx files recursively
function findTsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findTsxFiles(filePath, fileList);
    } else if (file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Main function
console.log('🔄 Converting .tsx files to .jsx...\n');

const tsxFiles = findTsxFiles(srcDir);
console.log(`Found ${tsxFiles.length} .tsx files\n`);

let successCount = 0;
let errorCount = 0;

tsxFiles.forEach(tsxFile => {
  try {
    const relativePath = path.relative(__dirname, tsxFile);
    console.log(`Converting: ${relativePath}`);
    
    // Read original content
    let content = fs.readFileSync(tsxFile, 'utf8');
    
    // Update imports
    content = updateImports(content);
    
    // Clean TypeScript syntax
    content = cleanTypeScript(content);
    
    // Create .jsx file path
    const jsxFile = tsxFile.replace(/\.tsx$/, '.jsx');
    
    // Write .jsx file
    fs.writeFileSync(jsxFile, content, 'utf8');
    
    // Remove .tsx file
    fs.unlinkSync(tsxFile);
    
    console.log(`  ✅ Created: ${path.relative(__dirname, jsxFile)}\n`);
    successCount++;
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}\n`);
    errorCount++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`✅ Successfully converted: ${successCount} files`);
if (errorCount > 0) {
  console.log(`❌ Failed: ${errorCount} files`);
}
console.log('='.repeat(50) + '\n');
console.log('Don\'t forget to update index.html to reference main.jsx!');
