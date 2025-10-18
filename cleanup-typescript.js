import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cleanup remaining TypeScript syntax
function cleanupFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remove function parameter type annotations like (param: type)
  const paramTypePattern = /\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(string|number|boolean|any|void|Date|undefined|null)\)/g;
  if (paramTypePattern.test(content)) {
    content = content.replace(paramTypePattern, '($1)');
    modified = true;
  }

  // Remove type annotations from arrow function parameters
  const arrowParamPattern = /\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[^)]+\)\s*=>/g;
  if (arrowParamPattern.test(content)) {
    content = content.replace(arrowParamPattern, '($1) =>');
    modified = true;
  }

  // Remove property type annotations like: property: type;
  const propertyTypePattern = /^\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*[^;]+;\s*$/gm;
  if (propertyTypePattern.test(content)) {
    content = content.replace(propertyTypePattern, '');
    modified = true;
  }

  // Remove React generic type annotations
  const reactGenericPattern = /React\.(createContext|forwardRef)<[^>]+>/g;
  if (reactGenericPattern.test(content)) {
    content = content.replace(reactGenericPattern, 'React.$1');
    modified = true;
  }

  // Remove const assertions defaultOpen = true,
  const constDefaultPattern = /defaultOpen\s*=\s*true,/g;
  if (constDefaultPattern.test(content)) {
    content = content.replace(constDefaultPattern, 'defaultOpen = true,');
    modified = true;
  }

  // Clean up React.ComponentProps type annotations
  const componentPropsPattern = /React\.ComponentProps<"[^"]+"> & \{[^}]+\}/gs;
  if (componentPropsPattern.test(content)) {
    content = content.replace(componentPropsPattern, (match) => {
      return '{ ' + match.split(' & {')[1];
    });
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// Find all .jsx files
function findJsxFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findJsxFiles(filePath, fileList);
    } else if (file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

console.log('🧹 Cleaning up remaining TypeScript syntax...\n');

const srcDir = path.join(__dirname, 'src');
const jsxFiles = findJsxFiles(srcDir);
let cleanedCount = 0;

jsxFiles.forEach(file => {
  if (cleanupFile(file)) {
    console.log(`✅ Cleaned: ${path.relative(__dirname, file)}`);
    cleanedCount++;
  }
});

console.log(`\n✨ Cleaned ${cleanedCount} files`);
