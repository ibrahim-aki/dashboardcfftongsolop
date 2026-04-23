// --- FIREBASE INITIALIZATION ---
let firebaseConfig = null;
let db = null;


// --- STATE VARIABLES ---
let machineId = null;
let userProfile = null;
let isPremium = false;
let selectedFolders = [];
let selectedExcludes = [];
let scanResults = []; // Array of groups: { hash, size, files }
let selectedFiles = new Set(); // Map of file paths
let isScanning = false;
let groupBuffer = []; // Buffer for incremental rendering
let bufferInterval = null;

// --- DOM ELEMENTS ---
const folderListEl = document.getElementById('folder-list');
const addFolderBtn = document.getElementById('add-folder-btn');
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

// Premium Elements
const regModal = document.getElementById('register-modal');
const donateModal = document.getElementById('donate-modal');
const submitRegBtn = document.getElementById('submit-register-btn');
const regNameInput = document.getElementById('reg-name');
const regEmailInput = document.getElementById('reg-email');
const regErrorMsg = document.getElementById('reg-error');
const openDonateBtn = document.getElementById('open-donate-modal');
const closeDonateBtn = document.getElementById('close-donate-modal');
const submitProofBtn = document.getElementById('submit-proof-btn');
const proofImageInput = document.getElementById('proof-image');
const donateQrImg = document.getElementById('donate-qr-img');
const donateLinkContainer = document.getElementById('donate-link-container');
const donateUrlLink = document.getElementById('donate-url-link');
const regTosChk = document.getElementById('reg-tos-chk');
const tosModal = document.getElementById('tos-modal');

let trialDays = 15; // Default 15 hari (akan di-override oleh Firebase settings jika tersedia)
let isOffline = false;
let cloudSettings = null; // Store latest settings for bilingual updates

// --- I18N SYSTEM ---
const translations = {
    id: {
        update_banner: "Versi baru tersedia!",
        download: "UNDUH",
        folders_to_scan: "Folder untuk Dipindai",
        add: "Tambah",
        exclusions: "Pengecualian",
        start_scan: "🔍 MULAI PINDAI",
        stop_scan: "🛑 HENTIKAN",
        junk_tip: "Klik untuk membersihkan file sampah sistem Windows secara instan.",
        junk_scan: "⚡ PINDAI SAMPAH",
        permanent_delete: "Hapus Permanen",
        duplicate_results: "Hasil Duplikat",
        mode_label: "Mode:",
        level_1: "Tingkat 1: Terlama",
        level_4: "Tingkat 4: Terbaru",
        smart_select: "Seleksi Pintar",
        deselect: "Batal Pilih",
        delete: "Hapus",
        donate: "⚡ DONASI",
        register_title: "Registrasi Aplikasi",
        name_label: "Nama Lengkap:",
        email_label: "Email Utama:",
        email_tip: "* Gunakan email aktif untuk pemberitahuan/konfirmasi update.",
        tos_agree: "Saya menyetujui",
        tos_link: "Syarat & Ketentuan",
        tos_suffix: "serta kebijakan privasi yang berlaku pada aplikasi ini.",
        register_btn: "DAFTAR SEKARANG",
        donate_title: "Donasi & Dukungan",
        donate_tip: "Dukung pengembangan aplikasi ini dengan donasi seikhlasnya.",
        start_tip: "Klik 'Mulai Pindai' untuk memulai.",
        status_free: "FREE",
        status_donatur: "DONATUR",
        status_expired: "FREE (EXPIRED)"
    },
    en: {
        update_banner: "New version available!",
        download: "DOWNLOAD",
        folders_to_scan: "Folders to Scan",
        add: "Add",
        exclusions: "Exclusions",
        start_scan: "🔍 START SCAN",
        stop_scan: "🛑 STOP SCAN",
        junk_tip: "Click to clean Windows system junk files instantly.",
        junk_scan: "⚡ JUNK SCAN",
        permanent_delete: "Permanent Delete",
        duplicate_results: "Duplicate Results",
        mode_label: "Mode:",
        level_1: "Level 1: Oldest",
        level_4: "Level 4: Newest",
        smart_select: "Smart Select",
        deselect: "Deselect",
        delete: "Delete",
        donate: "⚡ DONATE",
        register_title: "App Registration",
        name_label: "Full Name:",
        email_label: "Main Email:",
        email_tip: "* Use an active email for update notifications.",
        tos_agree: "I agree to the",
        tos_link: "Terms & Conditions",
        tos_suffix: "and privacy policy applicable to this application.",
        register_btn: "REGISTER NOW",
        donate_title: "Donate & Support",
        donate_tip: "Support the development of this app with a donation.",
        start_tip: "Click 'Start Scan' to begin.",
        status_free: "FREE",
        status_donatur: "DONOR",
        status_expired: "FREE (EXPIRED)"
    }
};

let currentLang = localStorage.getItem('cff_lang') || 'id';

window.setLanguage = (lang) => {
    currentLang = lang;
    localStorage.setItem('cff_lang', lang);
    applyTranslations();
};

function applyTranslations() {
    const dict = translations[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            if (el.tagName === 'INPUT' && el.type === 'placeholder') {
                el.placeholder = dict[key];
            } else {
                el.textContent = dict[key];
            }
        }
    });

    // Update active button state
    const btnId = document.getElementById('btn-lang-id');
    const btnEn = document.getElementById('btn-lang-en');
    if (btnId) btnId.classList.toggle('active', currentLang === 'id');
    if (btnEn) btnEn.classList.toggle('active', currentLang === 'en');

    // Update dynamic cloud banner if exists
    renderUpdateBanner();
}

function renderUpdateBanner() {
    if (!cloudSettings) return;
    const bannerTextEl = document.getElementById('update-banner-text');
    const updateBanner = document.getElementById('update-banner');
    const updateBtn = document.getElementById('update-download-btn');

    // Priority: updateMessageEn for 'en', updateMessageId for 'id', fallback to updateMessage
    let msg = '';
    if (currentLang === 'en') {
        msg = cloudSettings.updateMessageEn || cloudSettings.updateMessage;
    } else {
        msg = cloudSettings.updateMessageId || cloudSettings.updateMessage;
    }

    if (msg && !cloudSettings.forceUpdate) {
        updateBanner.classList.remove('hidden');
        bannerTextEl.textContent = msg;
        if (cloudSettings.updateLink) {
            updateBtn.classList.remove('hidden');
            updateBtn.onclick = () => window.api.openUrl(cloudSettings.updateLink);
        } else {
            updateBtn.classList.add('hidden');
        }
    } else {
        updateBanner.classList.add('hidden');
    }
}

const forceUpdateModal = document.getElementById('force-update-modal');
const forceDownloadBtn = document.getElementById('force-download-btn');

// --- UTILS ---
const getCacheKey = () => `cff_cache_${machineId ? machineId.substring(0, 8) : 'guest'}`;

function saveLocalProfile(profile) {
    if (!machineId) return;
    const data = {
        profile,
        lastOnlineCheck: Date.now(),
        hwid: machineId
    };
    localStorage.setItem(getCacheKey(), JSON.stringify(data));
}

function getLocalProfile() {
    const raw = localStorage.getItem(getCacheKey());
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        // Validasi HWID (Anti-bajak)
        if (parsed.hwid !== machineId) return null;
        return parsed;
    } catch (e) { return null; }
}

function queueUsageData(fileCount, sizeBytes) {
    const stats = JSON.parse(localStorage.getItem('cff_pending_stats') || '{"files":0, "size":0}');
    stats.files += fileCount;
    stats.size += sizeBytes;
    localStorage.setItem('cff_pending_stats', JSON.stringify(stats));
    syncUsageData();
}

async function syncUsageData() {
    if (!db || !machineId || navigator.onLine === false) return;
    
    const raw = localStorage.getItem('cff_pending_stats');
    if (!raw) return;
    
    const stats = JSON.parse(raw);
    if (stats.files <= 0) return;

    try {
        await db.collection('users').doc(machineId).update({
            totalFilesCleaned: firebase.firestore.FieldValue.increment(stats.files),
            totalSizeSaved: firebase.firestore.FieldValue.increment(stats.size)
        });
        // Reset tabungan jika sukses
        localStorage.setItem('cff_pending_stats', JSON.stringify({files:0, size:0}));
        console.log("Statistics synced to cloud.");
    } catch (err) {
        console.error("Sync stats failed:", err);
    }
}


// --- INITIALIZATION ---

async function init() {
    console.log("Initializing application...");
    
    // 0. Get Machine ID first
    machineId = await window.api.getMachineId();
    console.log("Device ID:", machineId);

    // 1. Initialize Firebase
    firebaseConfig = await window.api.getFirebaseConfig();
    if (typeof firebase !== 'undefined' && firebaseConfig && firebaseConfig.apiKey) {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
        } catch (err) { console.error("Firebase init error:", err); }
    }

    // 2. Network Listener
    window.addEventListener('online', () => {
        isOffline = false;
        console.log("Internet back online. Syncing...");
        syncUsageData();
        // Refresh init data
        checkRegistration();
    });
    window.addEventListener('offline', () => {
        isOffline = true;
        portableBadge.textContent = 'OFFLINE MODE';
        portableBadge.classList.add('status-badge-offline');
    });

    // 3. Main Logic
    await checkRegistration();
}

async function checkRegistration() {
    // A. Real-time Settings Listener (QR, Link, Update, Trial Duration)
    if (db) {
        db.collection('settings').doc('donation').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                cloudSettings = data; // Save to global state
                
                // 1. FORCE UPDATE CHECK (LOCKED)
                if (data.updateLink && data.forceUpdate === true) {
                    forceUpdateModal.classList.remove('hidden');
                    forceDownloadBtn.onclick = () => window.api.openUrl(data.updateLink);
                } else {
                    forceUpdateModal.classList.add('hidden');
                }

                // 2. Global Settings Sync
                trialDays = data.trialDurationDays || 15;
                if (data.qrUrl) donateQrImg.src = data.qrUrl;

                // 3. Donation Link logic
                if (data.link) {
                    donateLinkContainer.classList.remove('hidden');
                    donateUrlLink.onclick = (e) => {
                        e.preventDefault();
                        let cleanLink = String(data.link).trim();
                        if (!cleanLink.startsWith('http')) cleanLink = 'https://' + cleanLink;
                        window.api.openUrl(cleanLink);
                    };
                } else {
                    donateLinkContainer.classList.add('hidden');
                }
                
                // 4. Update Banner (Non-Force) - Use the new bilingual function
                renderUpdateBanner();
            }
        });
    }

    // B. Check User Status (Hybrid: Cache vs Cloud)
    let profile = null;
    let fromCache = false;
    let cloudCheckSuccess = false; // Apakah cloud berhasil dihubungi?

    if (navigator.onLine && db) {
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));
            const doc = await Promise.race([db.collection('users').doc(machineId).get(), timeoutPromise]);
            cloudCheckSuccess = true; // Cloud BERHASIL dihubungi
            
            if (doc.exists) {
                profile = doc.data();
                saveLocalProfile(profile); // Update Cache
                console.log("Profile fetched from Cloud");
            } else {
                // User TIDAK ADA di cloud (dihapus oleh admin)
                // Hapus cache lokal agar tidak bisa masuk lagi
                localStorage.removeItem(getCacheKey());
                console.log("User deleted from cloud. Cache cleared.");
            }
        } catch (err) { 
            console.warn("Cloud check failed, falling back to cache..."); 
        }
    }

    // Cache HANYA dipakai jika cloud GAGAL dihubungi (offline/timeout)
    if (!profile && !cloudCheckSuccess) {
        const cached = getLocalProfile();
        if (cached) {
            profile = cached.profile;
            fromCache = true;
            console.log("Using cached profile (offline mode)");
        }
    }

    // Load local cache if offline
    if (!navigator.onLine) {
        handleOfflineStart();
    }

    // C. Apply Profile
    if (profile) {
        userProfile = profile;
        isPremium = profile.isPremium || false;
        
        // 5. TRIAL CALCULATION (Calendar-Based)
        if (!isPremium) {
            const trialInfo = calculateTrialStatus(profile);
            userProfile.trialDays = trialInfo.remaining;

            const dict = translations[currentLang];

            if (trialInfo.remaining <= 0) {
                portableBadge.textContent = `${userProfile.email} | ${dict.status_expired}`;
                portableBadge.classList.add('status-badge-offline');
            } else {
                const statusLabel = dict.status_free;
                const statusText = fromCache ? `${statusLabel} (OFFLINE)` : statusLabel;
                portableBadge.textContent = `${userProfile.email} | ${statusText}`;
                if (fromCache) portableBadge.classList.add('status-badge-offline');
            }
            
            // Sync sisa hari ke cloud jika online agar dashboard terupdate
            if (!fromCache && profile.trialDays !== trialInfo.remaining) {
                db.collection('users').doc(machineId).update({ trialDays: trialInfo.remaining });
            }
        } else {
            const dict = translations[currentLang];
            const donaturLabel = dict.status_donatur;
            portableBadge.textContent = `${userProfile.email} | ${donaturLabel} ${fromCache ? '(OFFLINE)' : ''}`;
            if (fromCache) portableBadge.classList.add('status-badge-offline');
            smartSelectBtn.classList.remove('premium-locked-btn');
            smartSelectBtn.title = 'Saran seleksi otomatis';
        }

    } else {
        // User Baru / Belum Daftar
        portableBadge.textContent = 'STATUS: GUEST (BELUM DAFTAR)';
        regModal.classList.remove('hidden');
    }
    
    syncUsageData();
}

function calculateTrialStatus(profile) {
    if (!profile.registeredAt) return { remaining: trialDays };
    
    const regDate = profile.registeredAt.toDate ? profile.registeredAt.toDate() : new Date(profile.registeredAt);
    const today = new Date();
    
    // Hitung selisih hari
    const diffTime = Math.abs(today - regDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // totalDays berasal dari settings dashboard (default 15)
    const remaining = Math.max(0, trialDays - (diffDays - 1));
    
    return {
        remaining: remaining,
        elapsed: diffDays
    };
}

// --- TOS MODAL ---
window.openTosModal = () => {
    tosModal.classList.remove('hidden');
};

window.closeTosModal = () => {
    tosModal.classList.add('hidden');
};

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

// --- PREMIUM & REGISTRATION LOGIC ---

submitRegBtn.addEventListener('click', async () => {
    const name = regNameInput.value.trim();
    const email = regEmailInput.value.trim();

    if (!name || !email) {
        regErrorMsg.textContent = "Nama dan Email wajib diisi!";
        regErrorMsg.classList.remove('hidden');
        return;
    }

    if (!regTosChk.checked) {
        regErrorMsg.textContent = "Anda harus menyetujui Syarat & Ketentuan!";
        regErrorMsg.classList.remove('hidden');
        return;
    }

    if (!db) return tampilkanModalWin98("Firebase belum terhubung. Periksa koneksi internet.", "Connection Error");

    try {
        submitRegBtn.disabled = true;
        submitRegBtn.textContent = "MENDAFTAR...";

        await db.collection('users').doc(machineId).set({
            name,
            email,
            machineId,
            registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
            isPremium: false,
            trialDays: 15, // Langsung punya 15 hari saat daftar
            status: 'REGISTERED'
        });

        regModal.classList.add('hidden');
        tampilkanModalWin98("Pendaftaran berhasil! Selamat menggunakan aplikasi Clone File Finder.", "Registration Success");
        
        // Muat ulang profil agar trial langsung aktif tanpa restart
        await checkRegistration();
    } catch (err) {
        console.error("Registration error:", err);
        regErrorMsg.textContent = "Gagal mendaftar. Coba lagi nanti.";
        regErrorMsg.classList.remove('hidden');
    } finally {
        submitRegBtn.disabled = false;
        submitRegBtn.textContent = "DAFTAR SEKARANG";
    }
});

openDonateBtn.addEventListener('click', () => {
    donateModal.classList.remove('hidden');
});

closeDonateBtn.addEventListener('click', () => {
    donateModal.classList.add('hidden');
});

// --- IMAGE COMPRESSION HELPER ---
function compressImage(file, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max resolution 1200px (width or height)
                const MAX_SIZE = 1200;
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

submitProofBtn.addEventListener('click', async () => {
    const file = proofImageInput.files[0];
    if (!file) return tampilkanModalWin98("Pilih file gambar bukti donasi terlebih dahulu.", "Attention");
    if (!db) return tampilkanModalWin98("Database tidak aktif.", "Error");

    try {
        submitProofBtn.disabled = true;
        submitProofBtn.textContent = "COMPRESSING...";

        // 1. Compress Image
        const compressedBlob = await compressImage(file);
        console.log(`Compressed: ${(file.size / 1024).toFixed(2)}KB -> ${(compressedBlob.size / 1024).toFixed(2)}KB`);

        submitProofBtn.textContent = "UPLOADING...";

        // 2. Cloudinary Upload
        const CLOUD_NAME = "dsbryri1d";
        const UPLOAD_PRESET = "buktidonasi";

        const formData = new FormData();
        formData.append("file", compressedBlob, "proof.jpg");
        formData.append("upload_preset", UPLOAD_PRESET);

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/dsbryri1d/image/upload`, {
            method: "POST",
            body: formData
        });

        if (!uploadRes.ok) {
            const errorData = await uploadRes.json();
            throw new Error(errorData.error ? errorData.error.message : "Upload to Cloudinary failed");
        }

        const uploadData = await uploadRes.json();

        // STEP 1: Update critical fields first (status & proof URL) - must succeed
        await db.collection('users').doc(machineId).set({
            status: 'WAITING_APPROVAL',
            proofUrl: uploadData.secure_url,
            proofPublicId: uploadData.public_id,
            proofSentAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // STEP 2: Update donation history (manual read-write, set+merge for new fields)
        try {
            const userDoc = await db.collection('users').doc(machineId).get();
            const existingData = userDoc.exists ? userDoc.data() : {};
            const existingHistory = Array.isArray(existingData.proofHistory) ? existingData.proofHistory : [];
            const existingTotal = typeof existingData.totalDonations === 'number' ? existingData.totalDonations : 0;

            const newEntry = {
                url: uploadData.secure_url,
                publicId: uploadData.public_id,
                sentAt: new Date().toISOString()
            };

            await db.collection('users').doc(machineId).set({
                totalDonations: existingTotal + 1,
                proofHistory: [...existingHistory, newEntry]
            }, { merge: true });
        } catch (historyErr) {
            alert('Peringatan: Riwayat donasi gagal disimpan: ' + historyErr.message);
        }

        tampilkanModalWin98("Terima kasih banyak atas dukungannya! Bukti donasi Anda telah kami terima. Admin akan melakukan aktivasi dalam waktu 1x24 jam. Mohon tunggu kabar baik dari kami.", "Donation Received");
        donateModal.classList.add('hidden');
    } catch (err) {
        console.error("Upload error:", err);
        tampilkanModalWin98("Gagal mengupload bukti: " + err.message, "Upload Error");
    } finally {
        submitProofBtn.disabled = false;
        submitProofBtn.textContent = "KIRIM BUKTI DONASI";
    }
});

// --- SCANNING ---

startScanBtn.addEventListener('click', async () => {
    if (selectedFolders.length === 0) return tampilkanModalWin98('Select at least one folder', 'Input Required');
    
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
        return tampilkanModalWin98('No junk folders found on this system.', 'Information');
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
    tampilkanModalWin98(`Error: ${error}`, 'Scan Error');
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
                const hasExt = file.name.includes('.');
                const rawExt = hasExt ? file.name.split('.').pop().toUpperCase() : 'FILE';
                const isMedia = ['JPG', 'JPEG', 'PNG', 'GIF', 'MP4', 'MKV', 'AVI'].includes(rawExt);
                
                // Cegah teks ekstensi merusak grid (batas max 6 huruf visual)
                const ext = rawExt.length > 6 ? rawExt.slice(0, 5) + '..' : rawExt;
                
                const isSelected = selectedFiles.has(file.path);
                const isSaved = group.isCleaned;
                
                return `
                <div class="file-item" style="${isSaved ? 'background: #f0fff0;' : ''}">
                    <input type="checkbox" style="margin: 0;" 
                        ${isSelected ? 'checked' : ''} 
                        ${isSaved ? 'disabled' : ''}
                        onchange="toggleFileSimple(this, '${file.path.replace(/\\/g, '\\\\')}', ${file.size})">
                    
                    <div class="thumb-box inset" style="display: flex; align-items: center; justify-content: center; height: 100%;">
                        ${isMedia ? `<img class="lazy-thumb" data-path="${file.path.replace(/\\/g, '\\\\')}" style="max-width: 100%; max-height: 100%; display: none;">` : '📄'}
                    </div>

                    <div class="ellipsis" style="${isSaved ? 'color: #008800; font-weight: bold;' : ''}" title="${file.name}">
                        ${isSaved ? '[SAVED] ' : ''}${file.name}
                    </div>
                    
                    <div class="ellipsis" style="color: var(--win-blue); font-weight: bold; text-align: center;" title="${rawExt}">${ext}</div>
                    
                    <div class="file-path ellipsis">${file.path}</div>
                    
                    <div style="font-size: 9px; color: #808080; text-align: right; padding-right: 4px;">
                        ${new Date(file.mtime).toLocaleDateString()}
                    </div>
                    
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
    // Izin berdasarkan status Premium atau sisa hari Trial (Freemium)
    let canUseSmartSelect = isPremium;

    if (!isPremium && userProfile) {
        const userTrial = userProfile.trialDays !== undefined ? userProfile.trialDays : 15;
        if (userTrial > 0) {
            canUseSmartSelect = true;
            console.log(`User Freemium aktif: sisa ${userTrial} hari.`);
        }
    }

    if (!canUseSmartSelect) {
        document.getElementById('smart-select-modal').classList.remove('hidden');
        return;
    }

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

deleteBtn.addEventListener('click', async () => {
    if (selectedFiles.size === 0) return tampilkanModalWin98('No files selected', 'Attention');
    
    const confirmMsg = `Are you sure you want to move ${selectedFiles.size} files to the Recycle Bin?`;
    const confirmed = await konfirmasiModalWin98(confirmMsg, 'Confirm Delete');
    
    if (confirmed) {
        executeDelete();
    }
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
    let successSize = 0;
    let failCount = 0;
    let errors = [];
    const successfullyDeleted = new Set();

    // Map untuk mencari size file berdasarkan path dengan cepat
    const fileMap = new Map();
    scanResults.forEach(g => g.files.forEach(f => fileMap.set(f.path, f.size)));

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
            successSize += (fileMap.get(path) || 0); // Tambah size sukses
            successfullyDeleted.add(path);
        } else {
            failCount++;
            errors.push(`${path.split('\\').pop()}: ${res.error}`);
        }
    }

    // KIRIM STATISTIK KE ANTREAN (OFFLINE FRIENDLY)
    if (successCount > 0) {
        queueUsageData(successCount, successSize);
    }

    // Sembunyikan Progress UI
    deleteProgressContainer.classList.add('hidden');
    statusLink.classList.remove('hidden');
    
    let message = `Successfully deleted ${successCount} files.`;
    if (failCount > 0) {
        message += `\n\n⚠️ Failed to delete ${failCount} files (likely in use):\n` + errors.slice(0, 5).join('\n');
        if (errors.length > 5) message += '\n...and more.';
    }
    // Tampilkan hasil akhir dengan warna (Gunakan variabel yang sudah dideklarasikan di atas)
    let finalMessage = `<span style="color: green; font-weight: bold;">Successfully deleted <span style="color: red; font-size: 14px;">${successCount}</span> files.</span>\n` +
                       `<span style="color: green; font-weight: bold;">Total space cleared: <span style="color: #0000ff; font-size: 14px;">${formatSize(successSize)}</span></span>`;
    
    if (failCount > 0) {
        finalMessage += `\n\n<span style="color: #666;">⚠️ Failed to delete <span style="color: red;">${failCount}</span> files (likely in use):</span>\n` + errors.slice(0, 5).join('\n');
    }

    tampilkanModalWin98(finalMessage, "Delete Task Completed");
    
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

// --- GLOBAL CUSTOM DIALOGS (WIN98 STYLE) ---
function tampilkanModalWin98(message, title = 'System Message') {
    return new Promise((resolve) => {
        const modal = document.getElementById('win98-modal-container');
        const titleEl = document.getElementById('win98-modal-title');
        const msgEl = document.getElementById('win98-modal-message');
        const okBtn = document.getElementById('win98-modal-ok');
        const cancelBtn = document.getElementById('win98-modal-cancel');
        const closeBtn = document.getElementById('win98-modal-close');

        titleEl.textContent = title;
        msgEl.innerHTML = message.replace(/\n/g, '<br>'); // Mendukung warna via HTML
        okBtn.classList.remove('hidden');
        cancelBtn.classList.add('hidden');
        modal.classList.remove('hidden');

        const cleanup = () => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            closeBtn.removeEventListener('click', onOk);
        };

        const onOk = () => {
            cleanup();
            resolve();
        };

        okBtn.addEventListener('click', onOk);
        closeBtn.addEventListener('click', onOk);
    });
}

function konfirmasiModalWin98(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const modal = document.getElementById('win98-modal-container');
        const titleEl = document.getElementById('win98-modal-title');
        const msgEl = document.getElementById('win98-modal-message');
        const okBtn = document.getElementById('win98-modal-ok');
        const cancelBtn = document.getElementById('win98-modal-cancel');
        const closeBtn = document.getElementById('win98-modal-close');

        titleEl.textContent = title;
        msgEl.innerHTML = message.replace(/\n/g, '<br>');
        okBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
        modal.classList.remove('hidden');

        const cleanup = () => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
        };

        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
    });
}
