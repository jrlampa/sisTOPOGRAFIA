import fs from 'fs';
import path from 'path';

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').length;
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const files = [];
walkDir('sisrua_unified/server', (filePath) => {
  if (filePath.endsWith('.ts')) {
    files.push({ path: filePath, lines: countLines(filePath) });
  }
});

files.sort((a, b) => b.lines - a.lines);
console.log(JSON.stringify(files.slice(0, 20), null, 2));
