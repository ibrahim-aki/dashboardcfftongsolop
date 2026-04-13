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
        alert(`Warning: Portable mode restricted. Data saved to AppData.\nError: ${status.error}`);
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
    window.api.startScan(selectedFolders, excludes);
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
    
    groupEl.innerHTML = `
        <div class="group-header">
            <span>Group ${index + 1} [${formatSize(group.size)} each]</span>
            <span class="file-path">${group.hash.slice(0, 12)}</span>
        </div>
        <div>
            ${group.files.map(file => {
                const ext = file.path.split('.').pop().toUpperCase();
                const isMedia = ['JPG', 'JPEG', 'PNG', 'GIF', 'MP4', 'MKV', 'AVI'].includes(ext);
                
                return `
                <div class="file-item">
                    <input type="checkbox" style="margin-right: 4px;" ${selectedFiles.has(file.path) ? 'checked' : ''} 
                        onchange="toggleFileSimple(this, '${file.path.replace(/\\/g, '\\\\')}', ${file.size})">
                    
                    <div class="thumb-box inset" style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; margin-right: 4px;">
                        ${isMedia ? `<img class="lazy-thumb" data-path="${file.path.replace(/\\/g, '\\\\')}" style="max-width: 100%; max-height: 100%; display: none;">` : '📄'}
                    </div>

                    <span style="flex: 2; cursor: default; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.name}">${file.name}</span>
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
    scanResults.forEach(group => {
        // Urutkan berdasarkan mtime (paling lama pertama)
        const sortedFiles = [...group.files].sort((a, b) => new Date(a.mtime) - new Date(b.mtime));
        // Sisakan yang paling lama, pilih sisanya
        for (let i = 1; i < sortedFiles.length; i++) {
            selectedFiles.add(sortedFiles[i].path);
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
    let successCount = 0;
    
    for (const path of pathsToDelete) {
        const res = await window.api.deleteFile(path);
        if (res.success) {
            successCount++;
        }
    }
    
    alert(`Successfully moved ${successCount} files to Recycle Bin.`);
    
    // Refresh results (remove deleted files from state)
    scanResults = scanResults.map(group => ({
        ...group,
        files: group.files.filter(f => !selectedFiles.has(f.path))
    })).filter(group => group.files.length > 1);
    
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
