#!/usr/bin/env node

/**
 * Quick validation script for TidyJS E2E tests
 * Checks that all test files are properly structured and can be compiled
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDir = __dirname;
const requiredFiles = [
    'basic.test.ts',
    'integration.test.ts', 
    'code-analysis.test.ts',
    'editor-features.test.ts',
    'advanced-features.test.ts',
    'tidyjs-scenarios.test.ts',
    'performance.test.ts'
];

console.log('🔍 Validating TidyJS E2E Test Suite...\n');

// Check if all required test files exist
console.log('📁 Checking test files:');
let allFilesExist = true;

for (const file of requiredFiles) {
    const filePath = path.join(testDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MISSING`);
        allFilesExist = false;
    }
}

if (!allFilesExist) {
    console.log('\n❌ Some test files are missing!');
    process.exit(1);
}

// Check infrastructure files
console.log('\n🏗️  Checking infrastructure:');
const infraFiles = ['runTest.ts', 'suite/index.ts', 'tsconfig.json'];

for (const file of infraFiles) {
    const filePath = path.join(testDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MISSING`);
        allFilesExist = false;
    }
}

// Count total tests
console.log('\n📊 Analyzing test content:');
let totalTests = 0;
let totalDescribeBlocks = 0;

for (const file of requiredFiles) {
    const filePath = path.join(testDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const testMatches = content.match(/it\(/g) || [];
    const describeMatches = content.match(/describe\(/g) || [];
    
    totalTests += testMatches.length;
    totalDescribeBlocks += describeMatches.length;
    
    console.log(`  📝 ${file}: ${testMatches.length} tests, ${describeMatches.length} suites`);
}

console.log(`\n📈 Total: ${totalTests} tests in ${totalDescribeBlocks} test suites`);

// Try to compile tests
console.log('\n🔨 Compiling tests...');
try {
    execSync('npm run compile-e2e', { 
        cwd: path.join(testDir, '../..'),
        stdio: 'pipe'
    });
    console.log('  ✅ Compilation successful');
} catch (error) {
    console.log('  ❌ Compilation failed');
    console.log(error.stdout?.toString());
    console.log(error.stderr?.toString());
    process.exit(1);
}

// Check package.json scripts
console.log('\n📋 Checking package.json scripts:');
const packagePath = path.join(testDir, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const requiredScripts = ['test:e2e', 'compile-e2e'];
for (const script of requiredScripts) {
    if (packageJson.scripts && packageJson.scripts[script]) {
        console.log(`  ✅ ${script}: ${packageJson.scripts[script]}`);
    } else {
        console.log(`  ❌ ${script} - MISSING`);
        allFilesExist = false;
    }
}

// Final validation
if (allFilesExist && totalTests > 0) {
    console.log('\n🎉 Validation successful!');
    console.log(`✅ ${totalTests} tests ready to run`);
    console.log(`✅ All infrastructure files present`);
    console.log(`✅ TypeScript compilation successful`);
    console.log('\nRun tests with: npm run test:e2e');
} else {
    console.log('\n❌ Validation failed!');
    process.exit(1);
}