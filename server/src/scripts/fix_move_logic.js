
const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../controllers/document.controller.ts');
let content = fs.readFileSync(targetFile, 'utf8');

const startMarker = "} else if (existing?.content && existing.content.includes('G:\\\\')) {";
const endMarker = "// CRITICAL: Force update status to SIGNED";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find markers!');
    console.log('Start found:', startIndex !== -1);
    console.log('End found:', endIndex !== -1);
    process.exit(1);
}

const newLogic = `        } else if (existing?.content && existing.content.includes('G:\\\\')) {
            // SIMPLIFIED LOGIC: Use DB Path
            const newTitle = updateBody.title || existing.title;
            const catIdForMove = updateBody.categoryId ? parseInt(updateBody.categoryId) : existing.categoryId;
            const deptIdForMove = updateBody.departmentId ? parseInt(updateBody.departmentId) : existing.departmentId;

            const titleChanged = updateBody.title && updateBody.title !== existing.title;
            const categoryChanged = updateBody.categoryId && parseInt(updateBody.categoryId) !== existing.categoryId;
            const deptChanged = updateBody.departmentId && parseInt(updateBody.departmentId) !== existing.departmentId;

            if (titleChanged || categoryChanged || deptChanged) {
                 console.log('[MOVE_LOGIC] Metadata changed, attempting move...');
                 try {
                    const oldPath = existing.content;
                    if (fs.existsSync(oldPath)) {
                        // 1. Get Root
                         const GDRIVE_ROOT = 'G:\\\\My Drive\\\\DMS';
                         const PREFERRED_ROOT = 'G:\\\\DMS_DATA';
                         let root = path.join(__dirname, '../../uploads');
                         if (fs.existsSync('G:\\\\')) {
                             if (fs.existsSync(GDRIVE_ROOT)) root = GDRIVE_ROOT;
                             else if (fs.existsSync('G:\\\\My Drive')) root = GDRIVE_ROOT;
                             else if (fs.existsSync(PREFERRED_ROOT)) root = PREFERRED_ROOT;
                         }

                        // 2. Resolve Path
                        let relativePath = '';
                        let departmentName = 'General';
                        
                        if (deptIdForMove) {
                             const dept = await prisma.department.findUnique({ where: { id: deptIdForMove } });
                             if (dept) departmentName = dept.name;
                        }

                        if (catIdForMove) {
                            const cat = await prisma.category.findUnique({ where: { id: catIdForMove } });
                            if (cat) {
                                if (cat.path) {
                                    relativePath = cat.path;
                                } else {
                                    // Fallback if path missing (just in case)
                                    const sanitize = (name) => name.replace(/[<>:"\\\\/\\\\|?*]/g, '_');
                                    relativePath = [sanitize(departmentName), sanitize(cat.name)].join('/');
                                }
                            }
                        } else {
                            const sanitize = (name) => name.replace(/[<>:"\\\\/\\\\|?*]/g, '_');
                            relativePath = sanitize(departmentName);
                        }

                        // 3. Target Dir
                        console.log('[MOVE_LOGIC] Target Relative Path:', relativePath);
                        const targetDir = path.join(root, ...relativePath.split('/').map(p => p.trim()));

                        if (!fs.existsSync(targetDir)) {
                            fs.mkdirSync(targetDir, { recursive: true });
                        }

                        const ext = path.extname(oldPath);
                        const sanitize = (name) => name.replace(/[<>:"\\\\/\\\\|?*]/g, '_');
                        const safeBaseName = sanitize(newTitle);
                        const newFilename = \`\${safeBaseName}_\${Date.now()}\${ext}\`;
                        const newPath = path.join(targetDir, newFilename);

                        if (oldPath !== newPath) {
                            try {
                                fs.renameSync(oldPath, newPath);
                                updateBody.content = newPath;
                                console.log('[MOVE_LOGIC] Moved to:', newPath);
                            } catch (e) {
                                if (e.code === 'EXDEV') {
                                    fs.copyFileSync(oldPath, newPath);
                                    fs.unlinkSync(oldPath);
                                    updateBody.content = newPath;
                                    console.log('[MOVE_LOGIC] Moved (Copy+Delete) to:', newPath);
                                } else {
                                    throw e;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error moving file:', error);
                }
            }
        }
`;

const newContent = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
fs.writeFileSync(targetFile, newContent, 'utf8');
console.log('Successfully patched document.controller.ts');
