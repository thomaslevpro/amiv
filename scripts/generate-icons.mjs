import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/amiv-icon.svg');
await sharp(Buffer.from(svg)).resize(192).png().toFile('public/amiv-icon-192.png');
await sharp(Buffer.from(svg)).resize(512).png().toFile('public/amiv-icon-512.png');
await sharp(Buffer.from(svg)).resize(180).png().toFile('public/apple-touch-icon.png');
await sharp(Buffer.from(svg)).resize(32).png().toFile('public/favicon-32.png');
console.log('✅ Icônes générées');
