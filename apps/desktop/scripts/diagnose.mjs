#!/usr/bin/env node

/**
 * Diagnostic script to check if the setup is correct
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('🔍 Moleui Desktop Diagnostic\n');

const checks = [];

// Check 1: Required files exist
const requiredFiles = [
  'src/main.tsx',
  'src/App.tsx',
  'src/index.css',
  'index.html',
  'vite.config.ts',
  'tailwind.config.js',
  'tsconfig.json',
  'package.json',
  'main.js',
  'preload.js',
];

console.log('📁 Checking required files...');
requiredFiles.forEach((file) => {
  const exists = existsSync(join(rootDir, file));
  checks.push({ name: file, status: exists });
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Check 2: Component files
const componentFiles = [
  'src/components/ui/Button.tsx',
  'src/components/ui/Card.tsx',
  'src/components/ui/Spinner.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/layout/NavItem.tsx',
  'src/components/common/StartScreen.tsx',
];

console.log('\n🧩 Checking components...');
componentFiles.forEach((file) => {
  const exists = existsSync(join(rootDir, file));
  checks.push({ name: file, status: exists });
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Check 3: Page files
const pageFiles = [
  'src/pages/SmartCarePage.tsx',
  'src/pages/CleanPage.tsx',
  'src/pages/UninstallPage.tsx',
  'src/pages/OptimizePage.tsx',
  'src/pages/AnalyzePage.tsx',
  'src/pages/StatusPage.tsx',
];

console.log('\n📄 Checking pages...');
pageFiles.forEach((file) => {
  const exists = existsSync(join(rootDir, file));
  checks.push({ name: file, status: exists });
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Check 4: Utility files
const utilFiles = [
  'src/utils/cn.ts',
  'src/utils/format.ts',
  'src/types/index.ts',
];

console.log('\n🔧 Checking utilities...');
utilFiles.forEach((file) => {
  const exists = existsSync(join(rootDir, file));
  checks.push({ name: file, status: exists });
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// Check 5: node_modules
console.log('\n📦 Checking dependencies...');
const nodeModulesExists = existsSync(join(rootDir, 'node_modules'));
checks.push({ name: 'node_modules', status: nodeModulesExists });
console.log(`  ${nodeModulesExists ? '✅' : '❌'} node_modules`);

if (!nodeModulesExists) {
  console.log('  ⚠️  Run: bun install');
}

// Check 6: Key dependencies
const keyDeps = [
  'node_modules/react',
  'node_modules/react-dom',
  'node_modules/lucide-react',
  'node_modules/tailwindcss',
  'node_modules/vite',
  'node_modules/electron',
];

if (nodeModulesExists) {
  console.log('\n📚 Checking key dependencies...');
  keyDeps.forEach((dep) => {
    const exists = existsSync(join(rootDir, dep));
    checks.push({ name: dep, status: exists });
    console.log(`  ${exists ? '✅' : '❌'} ${dep.split('/')[1]}`);
  });
}

// Summary
const passed = checks.filter((c) => c.status).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

console.log('\n' + '='.repeat(50));
console.log(`📊 Summary: ${passed}/${total} checks passed (${percentage}%)`);
console.log('='.repeat(50));

if (percentage === 100) {
  console.log('\n✅ All checks passed! Setup looks good.');
  console.log('\n🚀 Run: bun run dev');
} else if (percentage >= 80) {
  console.log('\n⚠️  Most checks passed, but some files are missing.');
  console.log('   Review the failed checks above.');
} else {
  console.log('\n❌ Many checks failed. Setup is incomplete.');
  console.log('\n💡 Try:');
  console.log('   1. bun install');
  console.log('   2. Check if you\'re in the correct directory');
  console.log('   3. Review archive/TROUBLESHOOTING.md');
}

console.log('\n📖 For help, see:');
console.log('   - archive/TROUBLESHOOTING.md');
console.log('   - archive/TEST_SETUP.md');
console.log('   - README.md\n');

process.exit(percentage === 100 ? 0 : 1);
