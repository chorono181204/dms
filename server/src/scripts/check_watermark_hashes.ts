import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const assetBase = path.join(__dirname, '../assets/watermarks');

const files = [
    { name: 'Tài liệu nội bộ của khoa Hoá sinh.png', label: 'Hoa Sinh' },
    { name: 'Tài liệu nội bộ của khoa Vi sinh.png', label: 'Vi Sinh' },
    { name: 'tài liệu nội bộ của khoa huyết học truyền máu.png', label: 'HHTM' }
];

console.log('--- Checking Hashes ---');

files.forEach(f => {
    const filePath = path.join(assetBase, f.name);
    if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        console.log(`File: ${f.label}`);
        console.log(`  Size: ${buffer.length}`);
        console.log(`  MD5:  ${hash}`);
    } else {
        console.log(`File: ${f.label} - NOT FOUND`);
    }
});
console.log('--- End ---');
