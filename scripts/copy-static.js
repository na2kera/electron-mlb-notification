#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const staticDir = path.join(projectRoot, 'static');
const distDir = path.join(projectRoot, 'dist');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error('Failed to ensure directory', dir, error);
    process.exit(1);
  }
}

async function copyRecursive(src, dest) {
  const stats = await fs.stat(src);
  if (stats.isDirectory()) {
    await ensureDir(dest);
    const items = await fs.readdir(src);
    await Promise.all(
      items.map(async (item) => {
        await copyRecursive(path.join(src, item), path.join(dest, item));
      })
    );
  } else {
    await ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
  }
}

(async () => {
  try {
    await ensureDir(distDir);
    await copyRecursive(staticDir, distDir);
    console.log('Static assets copied to dist');
  } catch (error) {
    console.error('Failed to copy static assets', error);
    process.exit(1);
  }
})();
