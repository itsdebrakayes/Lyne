import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');

// Function to remove TypeScript type annotations and interfaces
function removeTypeScript(content) {
  let modified = content;

  // Remove import type statements
  modified = modified.replace(/import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*/g, '');
  
  // Remove interface declarations (multi-line, more careful)
  modified = modified.replace(/interface\s+\w+\s*\{[^}]*\}\s*/g, '');
  
  // Remove type definitions
  modified = modified.replace(/type\s+\w+\s*=\s*[^;]+;?\s*/g, '');
  
  // Remove React.FC and similar type annotations from components
  modified = modified.replace(/:\s*React\.FC<[^>]*>/g, '');
  modified = modified.replace(/:\s*FC<[^>]*>/g, '');
  
  // Remove type annotations from destructured parameters more carefully
  // Pattern: ({ param1, param2 }: TypeName)
  modified = modified.replace(/\(\s*\{([^}]+)\}\s*:\s*\w+\s*\)/g, '({ $1 })');
  
  // Remove type annotations from regular parameters
  // Pattern: (param: Type) but be careful not to break JSX
  modified = modified.replace(/\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^,)]+\)/g, '($1)');
  modified = modified.replace(/,\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^,)]+/g, ', $1');
  
  // Remove return type annotations from functions
  // Pattern: ): ReturnType => or ): ReturnType {
  modified = modified.replace(/\)\s*:\s*[^{=>]+(\s*[{=>])/g, ')$1');
  
  // Remove type annotations from variable declarations
  modified = modified.replace(/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^=]+=/g, 'const $1 =');
  modified = modified.replace(/let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^=]+=/g, 'let $1 =');
  
  // Remove type annotations from arrow functions in variable declarations
  modified = modified.replace(/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\(([^)]*)\)\s*:\s*[^=>]+\s*=>/g, 'const $1 = ($2) =>');
  
  // Remove generic type parameters from function calls (but not JSX)
  modified = modified.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*)<[A-Z][^>]*>\(/g, '$1(');
  
  // Remove type assertions (as Type)
  modified = modified.replace(/\s+as\s+\w+/g, '');
  modified = modified.replace(/\s+as\s+const/g, '');
  
  // Remove non-null assertions (!)
  modified = modified.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*|\))\s*!/g, '$1');
  
  // Remove optional chaining with type assertions
  modified = modified.replace(/\?\s*\.\s*!/g, '?.');
  
  // Clean up extra whitespace
  modified = modified.replace(/\n\n\n+/g, '\n\n');
  
  // Clean up empty lines after interface/type removal
  modified = modified.replace(/^\s*\n\s*\n/gm, '\n');
  
  return modified;
}

// Function to update imports
function updateImports(content) {
  return content.replace(/from\s+['"](.*?)\.tsx['"]/g, 'from "$1.jsx"');
}

// Function to recursively find all .tsx files
function findTsxFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...findTsxFiles(fullPath));
    } else if (item.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main conversion function
function convertFiles() {
  console.log('Finding all .tsx files...');
  const tsxFiles = findTsxFiles(srcDir);
  console.log(`Found ${tsxFiles.length} .tsx files\n`);
  
  for (const tsxFile of tsxFiles) {
    console.log(`Converting: ${path.relative(__dirname, tsxFile)}`);
    
    // Read the file
    let content = fs.readFileSync(tsxFile, 'utf8');
    
    // Update imports first
    content = updateImports(content);
    
    // Remove TypeScript syntax
    content = removeTypeScript(content);
    
    // Create .jsx file path
    const jsxFile = tsxFile.replace(/\.tsx$/, '.jsx');
    
    // Write to .jsx file
    fs.writeFileSync(jsxFile, content, 'utf8');
    
    // Delete .tsx file
    fs.unlinkSync(tsxFile);
    
    console.log(`  ✓ Created: ${path.relative(__dirname, jsxFile)}`);
  }
  
  console.log('\n✓ Conversion complete!');
  console.log(`\nConverted ${tsxFiles.length} files from .tsx to .jsx`);
}

// Run the conversion
convertFiles();
