const folderListEl = document.getElementById('folder-list');
const addFolderBtn = document.getElementById('add-folder-btn');
const excludeInput = document.getElementById('exclude-input');
const startScanBtn = document.getElementById('start-scan-btn');
const stopScanBtn = document.getElementById('stop-scan-btn');
const resultsContent = document.getElementById('results-content');
const resultsViewport = document.getElementById('results-viewport');
const terminalHeader = document.getElementById('terminal-header');
const terminalLogs = document.getElementById('terminal-logs');
const portableBadge = document.getElementById('portable-badge');
const smartSelectBtn = document.getElementById('smart-select-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const addExcludeBtn = document.getElementById('add-exclude-btn');
const deleteBtn = document.getElementById('delete-selected-btn');
const summaryCountEl = document.getElementById('summary-count');
const summarySizeEl = document.getElementById('summary-size');
const tiktokLink = document.getElementById('tiktok-link');
const excludeListEl = document.getElementById('exclude-list');
const modalOverlay = document.getElementById('modal-overlay');
const modalBody = document.getElementById('modal-body');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const terminalStatus = document.getElementById('terminal-status');
const prioritySelect = document.getElementById('priority-folder-select');
const quickCleanBtn = document.getElementById('quick-clean-btn');
const permanentDeleteChk = document.getElementById('permanent-delete-chk');
const deleteProgressContainer = document.getElementById('delete-progress-container');
const deleteProgressBar = document.getElementById('delete-progress-bar');
const deleteProgressText = document.getElementById('delete-progress-text');
const statusLink = document.getElementById('status-link');

let selectedFolders = [];
let selectedExcludes = [];
let scanResults = []; // Array of groups: { hash, size, files }
let selectedFiles = new Set(); // Map of file paths
let isScanning = false;
let groupBuffer = []; // Buffer for incremental rendering
let bufferInterval = null;

// --- INITIALIZATION ---

async function init() {
    const status = await window.api.getPortableStatus();
    if (status.portable) {
        portableBadge.textContent = 'PORTABLE MODE';
        portableBadge.className = 'badge badge-portable';
    } else {
        portableBadge.textContent = 'FIXED MODE (LOCKED)';
        portableBadge.className = 'badge badge-fixed';
        if (status.error) {
            alert(`Warning: Portable mode restricted. Data saved to AppData.\nError: ${status.error}`);
        }
    }
}

init();

// --- FOLDER MANAGEMENT ---

addFolderBtn.addEventListener('click', async () => {
    const paths = await window.api.selectFolders();
    if (paths) {
        selectedFolders = [...new Set([...selectedFolders, ...paths])];
        renderFolderList();
    }
});

function renderFolderList() {
    if (selectedFolders.length === 0) {
        folderListEl.innerHTML = '<div style="color: gray; padding: 4px;">None</div>';
        return;
    }
    folderListEl.innerHTML = selectedFolders.map(path => `
        <div class="folder-item" title="${path}">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${path}</span>
            <button class="action-btn" onclick="removeFolder('${path.replace(/\\/g, '\\\\')}')">✕</button>
        </div>
    `).join('');
}

window.removeFolder = (path) => {
    selectedFolders = selectedFolders.filter(f => f !== path);
    renderFolderList();
};

function renderExcludeList() {
    if (selectedExcludes.length === 0) {
        excludeListEl.innerHTML = '<div style="color: gray; padding: 4px;">Default (System)</div>';
        return;
    }
    excludeListEl.innerHTML = selectedExcludes.map(path => `
        <div class="folder-item" title="${path}">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${path}</span>
            <button class="action-btn" onclick="removeExclude('${path.replace(/\\/g, '\\\\')}')">✕</button>
        </div>
    `).join('');
}

window.removeExclude = (path) => {
    selectedExcludes = selectedExcludes.filter(f => f !== path);
    renderExcludeList();
};

// --- SCANNING ---

startScanBtn.addEventListener('click', () => {
    if (selectedFolders.length === 0) return alert('Select at least one folder');
    
    isScanning = true;
    scanResults = [];
    groupBuffer = [];
    resultsContent.innerHTML = ''; // Clear for new scan
    selectedFiles.clear();
    updateUIForScanning(true);
    
    // Start buffer interval
    startBufferInterval();
    
    // Gunakan daftar folder pengecualian yang dipilih
    const excludes = [...selectedExcludes];
    window.api.startScan(selectedFolders, excludes, false);
});

quickCleanBtn.addEventListener('click', async () => {
    isScanning = true;
    scanResults = [];
    groupBuffer = [];
    resultsContent.innerHTML = '';
    selectedFiles.clear();
    updateUIForScanning(true);
    startBufferInterval();

    const junkPaths = await window.api.getJunkPaths();
    if (!junkPaths || junkPaths.length === 0) {
        isScanning = false;
        updateUIForScanning(false);
        return alert('No junk folders found on this system.');
    }

    const folders = junkPaths.map(p => p.path);
    window.api.startScan(folders, [], true); // isJunkScan = true
});

stopScanBtn.addEventListener('click', () => {
    window.api.stopScan();
    isScanning = false;
    updateUIForScanning(false);
    stopBufferInterval();
    terminalLogs.innerHTML = ''; // Clear logs on stop
});

window.api.onScanProgress((data) => {
    // Update Header with Percent and Icons
    const pctMsg = data.percent !== undefined ? ` [${data.percent}%]` : '';
    terminalHeader.innerHTML = `🔍 ${data.count || 0} | ⚠️ ${data.detected || 0}${pctMsg}`;
    
    // Add Log Line
    if (data.phase === 'SCANNING') {
        const color = data.isHit ? 'log-red' : 'log-green';
        addTerminalLog(`${data.isHit ? 'HIT:' : 'SCAN:'} ${data.currentFile.slice(-40)}`, color);
    } else if (data.phase === 'PARTIAL_HASH') {
        addTerminalLog(`VERIFY: Group ${data.current}/${data.total}`, 'log-yellow');
    } else if (data.phase === 'FULL_HASH') {
        addTerminalLog(`DEEP: ${data.status}`, 'log-cyan');
    }
});

function addTerminalLog(text, colorClass) {
    const line = document.createElement('div');
    line.className = `log-line ${colorClass}`;
    line.textContent = text;
    terminalLogs.appendChild(line);
    
    // Limit to 40 lines
    if (terminalLogs.children.length > 40) {
        terminalLogs.removeChild(terminalLogs.firstChild);
    }
}

window.api.onScanDone((results) => {
    isScanning = false;
    stopBufferInterval();
    processGroupBuffer(); // Final flush
    
    updateUIForScanning(false);
    
    terminalLogs.innerHTML = ''; // Clear logs on done
    addTerminalLog(`DONE: Found ${scanResults.length} groups.`, 'log-cyan');
    
    // Re-render summary (no full re-render needed as we used incremental)
    updateSummary();
});

window.api.onGroupFound((group) => {
    groupBuffer.push(group);
});

function startBufferInterval() {
    if (bufferInterval) clearInterval(bufferInterval);
    bufferInterval = setInterval(() => {
        processGroupBuffer();
    }, 200); // 200ms batching
}

function stopBufferInterval() {
    if (bufferInterval) {
        clearInterval(bufferInterval);
        bufferInterval = null;
    }
}

function processGroupBuffer() {
    if (groupBuffer.length === 0) return;
    
    const fragment = document.createDocumentFragment();
    groupBuffer.forEach(group => {
        // Add to state
        scanResults.push(group);
        // Create DOM
        const groupEl = createGroupElement(group, scanResults.length - 1);
        fragment.appendChild(groupEl);
    });
    
    resultsContent.appendChild(fragment);
    groupBuffer = [];
    
    // Trigger lazy thumbs for new elements
    initLazyThumbs();
}

window.api.onScanError((error) => {
    isScanning = false;
    updateUIForScanning(false);
    alert(`Error: ${error}`);
});

function updateUIForScanning(scanning) {
    startScanBtn.classList.toggle('hidden', scanning);
    quickCleanBtn.classList.toggle('hidden', scanning);
    stopScanBtn.classList.toggle('hidden', !scanning);
    addFolderBtn.disabled = scanning;
    terminalStatus.classList.remove('hidden'); // Always show when active
}

// --- RESULTS RENDERING (VIRTUAL LIST LITE) ---

function renderResults() {
    resultsContent.innerHTML = '';
    if (scanResults.length === 0) {
        resultsContent.innerHTML = '<div style="padding: 20px; text-align: center; color: gray;">No duplicates found.</div>';
        return;
    }
    scanResults.forEach((group, index) => {
        const groupEl = createGroupElement(group, index);
        resultsContent.appendChild(groupEl);
    });
    initLazyThumbs();
    updateSummary();
}

function createGroupElement(group, index) {
    const groupEl = document.createElement('div');
    groupEl.className = 'duplicate-group';
    
    const headerText = group.isCleaned
        ? `✅ [CLEANED] Original Kept (${group.files.length} file)`
        : (group.isJunk 
            ? `📂 [JUNK] ${group.folderName} (${group.files.length} files)`
            : `Group ${index + 1} [${formatSize(group.size)} each]`);
    
    const subHeaderText = group.isJunk 
        ? `Total: ${formatSize(group.files.reduce((a, b) => a + b.size, 0))}`
        : (group.isCleaned ? 'All duplicates removed' : group.hash.slice(0, 12));

    groupEl.innerHTML = `
        <div class="group-header" style="${group.isCleaned ? 'background: #d0ffd0; color: #006600;' : ''}">
            <span>${headerText}</span>
            <span class="file-path">${subHeaderText}</span>
        </div>
        <div>
            ${group.files.map(file => {
                const ext = file.path.split('.').pop().toUpperCase();
                const isMedia = ['JPG', 'JPEG', 'PNG', 'GIF', 'MP4', 'MKV', 'AVI'].includes(ext);
                const isSelected = selectedFiles.has(file.path);
                const isSaved = group.isCleaned;
                
                return `
                <div class="file-item" style="${isSaved ? 'background: #f0fff0;' : ''}">
                    <input type="checkbox" style="margin-right: 4px;" 
                        ${isSelected ? 'checked' : ''} 
                        ${isSaved ? 'disabled' : ''}
                        onchange="toggleFileSimple(this, '${file.path.replace(/\\/g, '\\\\')}', ${file.size})">
                    
                    <div class="thumb-box inset" style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; margin-right: 4px;">
                        ${isMedia ? `<img class="lazy-thumb" data-path="${file.path.replace(/\\/g, '\\\\')}" style="max-width: 100%; max-height: 100%; display: none;">` : '📄'}
                    </div>

                    <span style="flex: 2; cursor: default; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${isSaved ? 'color: #008800; font-weight: bold;' : ''}" title="${file.name}">${isSaved ? '[SAVED] ' : ''}${file.name}</span>
                    <span style="width: 40px; color: var(--win-blue); font-weight: bold; text-align: center;">${ext}</span>
                    <span class="file-path" style="flex: 3;">${file.path.slice(0, 50)}...</span>
                    <span style="font-size: 9px; color: #808080; width: 60px;">${new Date(file.mtime).toLocaleDateString()}</span>
                    <button class="mini-btn" title="Open Folder" onclick="window.api.openLocation('${file.path.replace(/\\/g, '\\\\')}')">Dir</button>
                </div>
                `;
            }).join('')}
        </div>
    `;
    return groupEl;
}


function initLazyThumbs() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const path = img.dataset.path;
                
                window.api.getThumbnail(path).then(dataUrl => {
                    if (dataUrl) {
                        img.src = dataUrl;
                        img.style.display = 'block';
                        img.parentElement.innerHTML = ''; // Clear emoji
                        img.parentElement.appendChild(img);
                    }
                });
                observer.unobserve(img);
            }
        });
    }, { root: resultsViewport, threshold: 0.1 });

    document.querySelectorAll('.lazy-thumb').forEach(img => observer.observe(img));
}

window.toggleFileSimple = (checkbox, path, size) => {
    if (checkbox.checked) {
        selectedFiles.add(path);
    } else {
        selectedFiles.delete(path);
    }
    updateSummary();
};

smartSelectBtn.addEventListener('click', () => {
    selectedFiles.clear();
    const tier = parseInt(prioritySelect.value) || 1;

    scanResults.forEach(group => {
        let filesInGroup = [...group.files];
        
        if (group.isJunk) {
            // Mode Sampah: Pilih semua tanpa sisa
            filesInGroup.forEach(file => {
                selectedFiles.add(file.path);
            });
        } else {
            // Mode Duplikat: Sisakan satu file asli
            filesInGroup.sort((a, b) => new Date(a.mtime) - new Date(b.mtime));

            let fileToKeep = null;
            if (tier === 1) fileToKeep = filesInGroup[0];
            else if (tier === 2) fileToKeep = filesInGroup[1] || filesInGroup[0];
            else if (tier === 3) fileToKeep = filesInGroup[2] || filesInGroup[filesInGroup.length - 1];
            else if (tier === 4) fileToKeep = filesInGroup[filesInGroup.length - 1];

            if (!fileToKeep) fileToKeep = filesInGroup[0];

            filesInGroup.forEach(file => {
                if (file.path !== fileToKeep.path) {
                    selectedFiles.add(file.path);
                }
            });
        }
    });
    renderResults();
});

deselectAllBtn.addEventListener('click', () => {
    selectedFiles.clear();
    renderResults();
});

addExcludeBtn.addEventListener('click', async () => {
    const paths = await window.api.selectFolders();
    if (paths) {
        selectedExcludes = [...new Set([...selectedExcludes, ...paths])];
        renderExcludeList();
    }
});

tiktokLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.api.openUrl('https://www.tiktok.com/@tongsolop?is_from_webapp=1&sender_device=pc');
});

function updateSummary() {
    summaryCountEl.textContent = `${selectedFiles.size} files selected`;
    
    let totalSize = 0;
    // Hitung ulang size dari scanResults berdasarkan seleksi
    scanResults.forEach(group => {
        group.files.forEach(file => {
            if (selectedFiles.has(file.path)) {
                totalSize += file.size;
            }
        });
    });
    
    summarySizeEl.textContent = `${formatSize(totalSize)} total`;
}

deleteBtn.addEventListener('click', () => {
    if (selectedFiles.size === 0) return alert('No files selected');
    
    modalBody.textContent = `Are you sure you want to move ${selectedFiles.size} files to the Recycle Bin?`;
    modalOverlay.classList.remove('hidden');
});

modalCancelBtn.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
});

modalConfirmBtn.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
    executeDelete();
});

async function executeDelete() {
    const pathsToDelete = Array.from(selectedFiles);
    const isPermanent = permanentDeleteChk.checked;
    const totalFiles = pathsToDelete.length;
    
    let successCount = 0;
    let failCount = 0;
    let errors = [];
    const successfullyDeleted = new Set();

    // Tampilkan Progress UI
    statusLink.classList.add('hidden');
    deleteProgressContainer.classList.remove('hidden');
    
    for (let i = 0; i < totalFiles; i++) {
        const path = pathsToDelete[i];
        
        // Update Progress Bar
        const percent = Math.floor(((i + 1) / totalFiles) * 100);
        deleteProgressBar.style.width = `${percent}%`;
        deleteProgressText.textContent = `Deleting: ${i + 1}/${totalFiles} (${percent}%)`;
        
        // Beri sedikit peluang UI untuk update jika perlu
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));

        const res = isPermanent 
            ? await window.api.deleteFilePermanently(path)
            : await window.api.deleteFile(path);
            
        if (res.success) {
            successCount++;
            successfullyDeleted.add(path);
        } else {
            failCount++;
            errors.push(`${path.split('\\').pop()}: ${res.error}`);
        }
    }

    // Sembunyikan Progress UI
    deleteProgressContainer.classList.add('hidden');
    statusLink.classList.remove('hidden');
    
    let message = `Successfully deleted ${successCount} files.`;
    if (failCount > 0) {
        message += `\n\n⚠️ Failed to delete ${failCount} files (likely in use):\n` + errors.slice(0, 5).join('\n');
        if (errors.length > 5) message += '\n...and more.';
    }
    alert(message);
    
    // Refresh results (remove ONLY successfully deleted files)
    scanResults = scanResults.map(group => {
        const remainingFiles = group.files.filter(f => !successfullyDeleted.has(f.path));
        // Jika tadinya duplikat (>1) dan sekarang sisa 1, tandai sebagai cleaned
        const wasCleaned = !group.isJunk && group.files.length > 1 && remainingFiles.length === 1;
        
        return {
            ...group,
            files: remainingFiles,
            isCleaned: group.isCleaned || wasCleaned
        };
    }).filter(group => {
        if (group.isJunk) return group.files.length > 0;
        // Tetap tampilkan jika masih duplikat (>1) ATAU jika sudah bersih (isCleaned)
        return group.files.length > 1 || group.isCleaned;
    });
    
    selectedFiles.clear();
    renderResults();
}

// --- HELPERS ---

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
