const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { folders, excludes, isJunkScan } = workerData;
const fileMapBySize = new Map(); // size -> [paths]
const duplicateGroups = [];
let totalFilesFound = 0;
let duplicatesFound = 0; // Hits based on size
let lastProgressReport = 0;
const REPORT_INTERVAL = 150; // ms

// --- UTILS ---

function isExcluded(filePath, name) {
    // Default system exclusions (case-insensitive)
    const systemExcludes = ['system volume information', 'appdata', 'node_modules', '.git', '.gemini'];
    if (systemExcludes.includes(name.toLowerCase())) return true;

    // Khusus Recycle Bin: Hanya blokir jika BUKAN mode junk scan
    if (!isJunkScan && name.toLowerCase() === '$recycle.bin') return true;
    
    // User exclusions (Precise Path Matching, Case-Insensitive)
    const normalizedPath = path.resolve(filePath).toLowerCase();
    for (const pattern of excludes) {
        if (!pattern) continue;
        const normalizedPattern = path.resolve(pattern).toLowerCase();
        
        // Match if it's the target folder OR a parent of it
        if (normalizedPath === normalizedPattern || normalizedPath.startsWith(normalizedPattern + path.sep)) {
            return true;
        }
    }
    return false;
}

function getPartialHash(filePath) {
    return new Promise((resolve) => {
        const stream = fs.createReadStream(filePath, { start: 0, end: 16383 }); // 16KB
        const hash = crypto.createHash('sha256');
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', () => resolve(null));
    });
}

async function getSmartHash(filePath, size) {
    // For small files (< 100MB), do full hash
    if (size < 100 * 1024 * 1024) {
        return new Promise((resolve) => {
            const stream = fs.createReadStream(filePath);
            const hash = crypto.createHash('sha256');
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', () => resolve(null));
        });
    }

    // For large files, sample 1MB from Start, Middle, and End
    return new Promise((resolve) => {
        const hash = crypto.createHash('sha256');
        const chunkSize = 1024 * 1024; // 1MB
        
        try {
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(chunkSize);
            
            // Read Start
            fs.readSync(fd, buffer, 0, chunkSize, 0);
            hash.update(buffer);
            
            // Read Middle
            const middlePos = Math.floor(size / 2) - Math.floor(chunkSize / 2);
            fs.readSync(fd, buffer, 0, chunkSize, middlePos);
            hash.update(buffer);
            
            // Read End
            const endPos = size - chunkSize;
            fs.readSync(fd, buffer, 0, chunkSize, endPos);
            hash.update(buffer);
            
            fs.closeSync(fd);
            resolve('SMART:' + hash.digest('hex'));
        } catch (err) {
            resolve(null);
        }
    });
}

// --- SCANNING ---

async function scanDirectory(dir) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isSymbolicLink()) continue; // Skip symlinks

            if (entry.isDirectory()) {
                if (!isExcluded(fullPath, entry.name)) {
                    await scanDirectory(fullPath);
                }
            } else if (entry.isFile()) {
                const stats = fs.statSync(fullPath);
                const size = stats.size;

                if (size === 0) continue; // Skip zero-byte files

                totalFilesFound++;
                if (!fileMapBySize.has(size)) {
                    fileMapBySize.set(size, []);
                } else {
                    duplicatesFound++;
                }
                fileMapBySize.get(size).push({
                    path: fullPath,
                    name: entry.name,
                    size: size,
                    mtime: stats.mtime
                });

                // Throttled progress report
                const now = Date.now();
                if (now - lastProgressReport > REPORT_INTERVAL) {
                    parentPort.postMessage({ 
                        type: 'progress', 
                        data: { 
                            phase: 'SCANNING', 
                            count: totalFilesFound, 
                            detected: duplicatesFound,
                            currentFile: fullPath,
                            isHit: (fileMapBySize.get(size).length > 1)
                        } 
                    });
                    lastProgressReport = now;
                }
            }
        }
    } catch (err) {
        // Silently skip folders with no access
    }
}

async function processDuplicates() {
    // Only process sizes with > 1 file
    const sizeGroups = Array.from(fileMapBySize.entries()).filter(([s, f]) => f.length > 1);
    const totalSizesToProcess = sizeGroups.length;
    let sizesProcessed = 0;

    for (const [size, files] of sizeGroups) {
        sizesProcessed++;
        const percent = Math.floor((sizesProcessed / totalSizesToProcess) * 100);
        
        // PASS 2: Partial Hash (16KB)
        parentPort.postMessage({ 
            type: 'progress', 
            data: { 
                phase: 'PARTIAL_HASH', 
                current: sizesProcessed, 
                total: totalSizesToProcess,
                count: totalFilesFound,
                detected: duplicatesFound,
                percent: percent
            } 
        });

        const partialHashMap = new Map();
        for (const file of files) {
            const pHash = await getPartialHash(file.path);
            if (!pHash) continue;
            if (!partialHashMap.has(pHash)) partialHashMap.set(pHash, []);
            partialHashMap.get(pHash).push(file);
        }

        // PASS 3: Full Hash
        for (const [pHash, pFiles] of partialHashMap.entries()) {
            if (pFiles.length < 2) continue;

            parentPort.postMessage({ 
                type: 'progress', 
                data: { 
                    phase: 'FULL_HASH', 
                    status: `Verifying content...`,
                    count: totalFilesFound,
                    detected: duplicatesFound,
                    percent: Math.floor((sizesProcessed / totalSizesToProcess) * 100)
                } 
            });

            const fullHashMap = new Map();
            for (const file of pFiles) {
                const fHash = await getSmartHash(file.path, file.size);
                if (!fHash) continue;
                if (!fullHashMap.has(fHash)) fullHashMap.set(fHash, []);
                fullHashMap.get(fHash).push(file);
            }

            // Results
            for (const [fHash, fFiles] of fullHashMap.entries()) {
                if (fFiles.length > 1) {
                    const group = { hash: fHash, size: size, files: fFiles };
                    duplicateGroups.push(group);
                    
                    // Emit incrementally
                    parentPort.postMessage({ type: 'group-found', data: group });
                }
            }
        }
    }
}

async function run() {
    try {
        if (isJunkScan) {
            // Mode Sampah: Kelompokkan berdasarkan folder asal
            for (const folder of folders) {
                const junkFiles = [];
                let folderSize = 0;
                
                await collectAllFiles(folder, junkFiles);
                
                if (junkFiles.length > 0) {
                    const totalSize = junkFiles.reduce((acc, f) => acc + f.size, 0);
                    const folderName = path.basename(folder) || folder;
                    
                    const group = { 
                        hash: `JUNK:${folderName}`, 
                        size: 0, // In junk mode, we don't use 'size each' logic in the same way
                        isJunk: true,
                        folderName: folderName,
                        files: junkFiles 
                    };
                    duplicateGroups.push(group);
                    parentPort.postMessage({ type: 'group-found', data: group });
                }
            }
        } else {
            // Mode Duplikat (Normal)
            for (const folder of folders) {
                await scanDirectory(folder);
            }
            await processDuplicates();
        }
        parentPort.postMessage({ type: 'done', data: duplicateGroups });
    } catch (err) {
        parentPort.postMessage({ type: 'error', data: err.message });
    }
}

async function collectAllFiles(dir, fileList) {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isSymbolicLink()) continue;

            if (entry.isDirectory()) {
                if (!isExcluded(fullPath, entry.name)) {
                    await collectAllFiles(fullPath, fileList);
                }
            } else if (entry.isFile()) {
                const stats = fs.statSync(fullPath);
                const size = stats.size;
                if (size === 0) continue;

                totalFilesFound++;
                const fileObj = {
                    path: fullPath,
                    name: entry.name,
                    size: size,
                    mtime: stats.mtime
                };
                fileList.push(fileObj);

                // Progress report
                const now = Date.now();
                if (now - lastProgressReport > REPORT_INTERVAL) {
                    parentPort.postMessage({ 
                        type: 'progress', 
                        data: { 
                            phase: 'SCANNING', 
                            count: totalFilesFound, 
                            detected: totalFilesFound,
                            currentFile: fullPath,
                            isHit: true
                        } 
                    });
                    lastProgressReport = now;
                }
            }
        }
    } catch (err) {
        // Skip
    }
}

run();
