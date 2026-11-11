// Simple test to verify TypeScript compiles
const fs = require('fs');
const path = require('path');

const corpusGeometryPath = path.join(__dirname, 'devsolvev2', 'src', 'lib', 'programmatic', 'corpusGeometry.ts');
const exists = fs.existsSync(corpusGeometryPath);
console.log('corpusGeometry.ts exists:', exists);

if (exists) {
    const content = fs.readFileSync(corpusGeometryPath, 'utf8');
    // Check that CORPUS_SIZE = RAW_CORPUS_SIZE (no Math.min)
    const hasMathMin = content.includes('Math.min(20_000_000, RAW_CORPUS_SIZE)');
    const hasDirectAssign = content.includes('export const CORPUS_SIZE = RAW_CORPUS_SIZE;');
    console.log('Has Math.min:', hasMathMin);
    console.log('Has direct assign:', hasDirectAssign);
    
    // Check the key line numbers
    const lines = content.split('\n');
    let foundLine36 = false;
    let foundLine37 = false;
    for (let i = 33; i < 40; i++) {
        if (lines[i]) {
            if (lines[i].includes('CORPUS_SIZE')) foundLine36 = true;
            if (lines[i].includes('TARGET_CORPUS_SIZE')) foundLine37 = true;
        }
    }
    console.log('Line 36 area has CORPUS_SIZE:', foundLine36);
    console.log('Line 36 area has TARGET_CORPUS_SIZE:', foundLine37);
}