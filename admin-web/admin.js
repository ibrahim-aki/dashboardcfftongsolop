console.log("admin.js loading...");
window.onerror = function(msg, url, line, col, error) {
    console.error("Global Error:", msg, "at", url, ":", line);
    alert("Terjadi kesalahan sistem: " + msg);
};

// --- FIREBASE CONFIG (Sama dengan di Electron) ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};


// Initialize Firebase
if (typeof firebase !== 'undefined') {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log("Firebase initialized successfully in Admin Dashboard");
    } catch (e) {
        console.error("Firebase init error:", e);
    }
} else {
    console.error("Firebase SDK not loaded!");
}

const auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

// --- DOM ELEMENTS ---
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userTableBody = document.getElementById('user-table-body');
const proofModal = document.getElementById('proof-modal');

const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');

// --- NEW ELEMENTS FOR SETTINGS ---
const navItems = document.querySelectorAll('.nav-item[data-view]');
const viewUsers = document.getElementById('view-users');
const viewSettings = document.getElementById('view-settings');
const currentQrImg = document.getElementById('current-qr-img');
const noQrMsg = document.getElementById('no-qr-msg');
const newQrInput = document.getElementById('new-qr-input');
const deleteQrBtn = document.getElementById('delete-qr-btn');
const donationLinkInput = document.getElementById('donation-link-input');
const updateMessageInput = document.getElementById('update-message-input');
const updateMessageEnInput = document.getElementById('update-message-en-input');
const updateLinkInput = document.getElementById('update-link-input');
const forceUpdateChk = document.getElementById('force-update-chk');
const trialDurationInput = document.getElementById('trial-duration-input');
const minVersionInput = document.getElementById('min-version-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const statImpactFiles = document.getElementById('stat-impact-files');

// --- TRIAL MODAL ELEMENTS ---
const trialModal = document.getElementById('trial-modal');
const trialModalUser = document.getElementById('trial-modal-user');
const editTrialDays = document.getElementById('edit-trial-days');
const editTrialMinutes = document.getElementById('edit-trial-minutes');
const saveTrialBtn = document.getElementById('save-trial-btn');

let currentEditingUserId = null;
let donationSettings = { qrUrl: '', qrPublicId: '', link: '', trialDurationDays: 15 };

// --- CLOUDINARY CONFIG ---
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET;
const CLOUDINARY_CLOUD_NAME = "dsbryri1d";

// --- VIEW SWITCHER ---
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.getAttribute('data-view');
        const viewUsers = document.getElementById('view-users');
        const viewSettings = document.getElementById('view-settings');
        const viewUpdates = document.getElementById('view-updates');
        
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Hide all
        viewUsers.classList.add('hidden');
        viewSettings.classList.add('hidden');
        viewUpdates.classList.add('hidden');

        // Show target
        if (view === 'users') {
            viewUsers.classList.remove('hidden');
            document.querySelector('.top-header h2').textContent = "Users Management";
        } else if (view === 'settings') {
            viewSettings.classList.remove('hidden');
            document.querySelector('.top-header h2').textContent = "Donation Settings";
            loadSettings();
        } else if (view === 'updates') {
            viewUpdates.classList.remove('hidden');
            document.querySelector('.top-header h2').textContent = "App Update Announcement";
            loadSettings();
        }
    });
});

// --- CLOUDINARY DELETE HELPER ---
async function deleteFromCloudinary(publicId) {
    if (!publicId || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        console.warn("Skipping Cloudinary delete: PublicId or Keys missing.");
        return;
    }

    const timestamp = Math.round((new Date()).getTime() / 1000);
    const signature = CryptoJS.SHA1(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`).toString();

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("timestamp", timestamp);
    formData.append("api_key", CLOUDINARY_API_KEY);
    formData.append("signature", signature);

    try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        console.log("Cloudinary Delete Result:", data);
        return data.result === 'ok';
    } catch (err) {
        console.error("Cloudinary Delete Error:", err);
        return false;
    }
}


// --- AUTH LISTENER ---
auth.onAuthStateChanged(user => {
    if (user) {
        // Logged in
        loginContainer.classList.add('hidden');
        dashboardContainer.classList.remove('hidden');
        loadUsers();
    } else {
        // Logged out
        loginContainer.classList.remove('hidden');
        dashboardContainer.classList.add('hidden');
    }
});

// --- LOGIN ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log("Login form submitted");
    
    const emailInput = loginForm.querySelector('input[name="email"]');
    const passwordInput = loginForm.querySelector('input[name="password"]');
    
    if (!emailInput || !passwordInput) {
        console.error("Form inputs not found!");
        return;
    }

    const email = emailInput.value;
    const password = passwordInput.value;
    console.log("Attempting login for:", email);

    if (!auth) {
        console.error("Auth object is missing");
        alert("Sistem autentikasi tidak siap. Periksa koneksi atau konfigurasi.");
        return;
    }

    try {
        loginError.classList.add('hidden');
        await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        loginError.textContent = "Login gagal: " + err.message;
        loginError.classList.remove('hidden');
    }
});

// --- LOGOUT ---
logoutBtn.addEventListener('click', () => auth.signOut());

// --- DATA FETCHING ---
let lastDocs = []; // Store last snapshot for auto-refresh
async function loadUsers() {
    try {
        // Real-time listener
        db.collection('users').orderBy('registeredAt', 'desc').onSnapshot(snapshot => {
            lastDocs = snapshot.docs;
            renderTable(snapshot.docs);
        });

        // Auto-refresh timer for dynamic trial countdown (every 30 seconds)
        setInterval(() => {
            if (lastDocs.length > 0) {
                console.log("Auto-refreshing trial countdowns...");
                renderTable(lastDocs);
            }
        }, 30000); 

    } catch (err) {
        console.error("Error loading users:", err);
    }
}

// Global storage for user proof data
const userProofData = {};

function getTrialInfo(user) {
    if (user.isPremium) return { days: 0, minutes: 0, totalMinutesRemaining: 0, isExpired: false };
    
    // 1. Get base duration
    const baseDays = user.trialDays !== undefined ? parseInt(user.trialDays) : (donationSettings.trialDurationDays || 15);
    const baseMinutes = user.trialMinutes !== undefined ? parseInt(user.trialMinutes) : 0;
    
    // 2. Check if we have trialUntil (New Logic - Dynamic Expiry)
    if (user.trialUntil) {
        const until = user.trialUntil.toDate ? user.trialUntil.toDate() : new Date(user.trialUntil);
        const now = new Date();
        const diffMs = until - now;
        const totalMinutesRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60)));
        return {
            days: Math.floor(totalMinutesRemaining / 1440),
            minutes: totalMinutesRemaining % 1440,
            totalMinutesRemaining,
            isExpired: totalMinutesRemaining <= 0
        };
    }

    // 3. Fallback to registration-based calculation (Legacy)
    if (!user.registeredAt) return { days: baseDays, minutes: baseMinutes, totalMinutesRemaining: (baseDays * 1440) + baseMinutes, isExpired: false };
    
    const regDate = user.registeredAt.toDate ? user.registeredAt.toDate() : new Date(user.registeredAt);
    const totalAllottedMinutes = (baseDays * 1440) + baseMinutes;
    const diffMs = new Date() - regDate;
    const elapsedMinutes = Math.floor(diffMs / (1000 * 60));
    const totalMinutesRemaining = Math.max(0, totalAllottedMinutes - elapsedMinutes);
    
    return {
        days: Math.floor(totalMinutesRemaining / 1440),
        minutes: totalMinutesRemaining % 1440,
        totalMinutesRemaining,
        isExpired: totalMinutesRemaining <= 0
    };
}

function renderTable(docs) {
    userTableBody.innerHTML = '';
    let pendingCount = 0;
    let totalFiles = 0;
    let totalSize = 0;

    docs.forEach(doc => {
        const user = doc.data();
        const id = doc.id;
        
        // Store proof data in JS memory
        if (user.proofUrl) {
            userProofData[id] = {
                url: user.proofUrl,
                history: user.proofHistory || []
            };
        }

        if (user.status === 'WAITING_APPROVAL') pendingCount++;
        totalFiles += (user.totalFilesCleaned || 0);
        totalSize += (user.totalSizeSaved || 0);

        const trial = getTrialInfo(user);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${user.name || 'No Name'}</strong></td>
            <td>${user.email || '-'}</td>
            <td style="font-family: monospace; font-size: 11px;">${id}</td>
            <td style="text-align: center;">
                <span class="stat-pill" style="background: #e3f2fd; color: #0d47a1; font-weight: bold;">
                    ${user.totalDonations || 0}x
                </span>
            </td>
            <td>
                ${user.proofUrl ? 
                    `<a href="#" class="action-link" style="color: blue; text-decoration: underline; font-size: 11px;" 
                        onclick="viewProof('${id}')">Lihat Bukti</a>` : 
                    '<span style="color: #ccc; font-size: 10px;">No Proof</span>'}
            </td>

            <td>
                <span style="font-weight: bold; color: #ff0000;">${user.totalFilesCleaned || 0}</span> / 
                <span style="color: #666; font-size: 11px;">${formatSize(user.totalSizeSaved || 0)}</span>
            </td>
            <td>
                ${user.isPremium ? 
                    '<span style="color: #10b981; font-weight: bold; font-size: 11px;">UNLIMITED</span>' : 
                    `<div class="trial-pill ${trial.isExpired ? 'expired' : ''}" 
                        onclick="openTrialModal('${id}', '${user.name || 'User'}', ${trial.days}, ${trial.minutes})">
                        <span>${trial.days}H</span>
                        <i>:</i>
                        <span>${trial.minutes}M</span>
                    </div>`
                }
            </td>
            <td>
                <span class="status-badge ${user.status ? user.status.toLowerCase().replace('_', '') : 'registered'}">
                    ${user.status || 'REGISTERED'}
                </span>
            </td>
            <td>
                <div class="btn-group">
                    ${user.isPremium ? 
                        `<button class="btn btn-warning btn-sm" onclick="resetUser('${id}')">NONAKTIFKAN</button>` : 
                        `<button class="btn btn-primary btn-sm" onclick="approveUser('${id}')">AKTIFKAN</button>`}
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${id}')">HAPUS</button>
                </div>
            </td>
        `;
        userTableBody.appendChild(row);
    });

    statTotal.textContent = docs.length;
    statPending.textContent = pendingCount;
    statImpactFiles.textContent = `${totalFiles} files (${formatSize(totalSize)})`;
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- TRIAL MODAL ACTIONS ---
window.openTrialModal = (userId, name, days, minutes) => {
    currentEditingUserId = userId;
    trialModalUser.textContent = `User: ${name} (${userId.substring(0, 8)}...)`;
    editTrialDays.value = days;
    editTrialMinutes.value = minutes;
    trialModal.classList.remove('hidden');
};

window.closeTrialModal = () => {
    trialModal.classList.add('hidden');
    currentEditingUserId = null;
};

saveTrialBtn.addEventListener('click', async () => {
    if (!currentEditingUserId) return;
    
    const days = parseInt(editTrialDays.value) || 0;
    const minutes = parseInt(editTrialMinutes.value) || 0;
    
    try {
        saveTrialBtn.disabled = true;
        saveTrialBtn.textContent = "SAVING...";
        
        // Calculate new expiry timestamp: Now + (Days + Minutes)
        const totalMinutes = (days * 1440) + minutes;
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + totalMinutes);
        
        await db.collection('users').doc(currentEditingUserId).update({
            trialUntil: firebase.firestore.Timestamp.fromDate(expiryDate),
            // Legacy support: update trialDays/trialMinutes to the new "allotted" values
            // so old apps don't immediately expire based on registration date.
            // Formula: allotted = remaining + elapsed_since_reg
            // But to keep it simple and clean, we'll just store trialUntil and 
            // let the new renderer.js handle it.
            trialDays: days,
            trialMinutes: minutes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Trial updated for ${currentEditingUserId}: ${days}d ${minutes}m`);
        closeTrialModal();
    } catch (err) {
        alert("Gagal update trial: " + err.message);
    } finally {
        saveTrialBtn.disabled = false;
        saveTrialBtn.textContent = "OKE";
    }
});

// --- PROOF MODAL ACTIONS ---
window.viewProof = (userId) => {
    const data = userProofData[userId];
    if (!data) return;

    const container = document.getElementById('proof-modal-body-content');
    const history = data.history;

    if (!history || history.length === 0) {
        // Hanya 1 bukti, tampilkan langsung
        container.innerHTML = `<img src="${data.url}" style="width: 100%; border-radius: 8px;">`;
    } else {
        // Tampilkan galeri riwayat
        const sorted = [...history].reverse();
        container.innerHTML = `
            <div style="max-height: 500px; overflow-y: auto; padding-right: 10px; text-align: left;">
                <h4 style="margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 5px;">Riwayat Bukti Donasi (${sorted.length})</h4>
                ${sorted.map((h, i) => `
                    <div style="margin-bottom: 20px; background: #f9f9f9; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                        <p style="font-size: 11px; color: #666; margin-bottom: 8px;">
                            <strong>Bukti ke-${sorted.length - i}</strong> &bull; ${new Date(h.sentAt || Date.now()).toLocaleString()}
                        </p>
                        <img src="${h.url}" style="width: 100%; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    </div>
                `).join('')}
            </div>
        `;
    }
    proofModal.classList.remove('hidden');
};

window.closeProofModal = () => {
    proofModal.classList.add('hidden');
};

// --- USER ACTIONS ---
window.approveUser = async (machineId) => {
    if (!confirm("Aktifkan fitur Premium untuk user ini?")) return;

    try {
        await db.collection('users').doc(machineId).update({
            isPremium: true,
            status: 'APPROVED',
            activatedAt: firebase.firestore.Timestamp.now()
        });
        alert("User berhasil diaktifkan!");
    } catch (err) {
        alert("Gagal mengaktifkan user: " + err.message);
    }
};

window.resetUser = async (machineId) => {
    const userDoc = await db.collection('users').doc(machineId).get();
    const userData = userDoc.data();

    if (!confirm("Nonaktifkan Premium? User akan kembali ke status FREE dan bukti donasi lamanya akan dihapus.")) return;

    try {
        // Hapus file bukti di Cloudinary jika ada publicId
        if (userData.proofPublicId) {
            await deleteFromCloudinary(userData.proofPublicId);
        }

        await db.collection('users').doc(machineId).update({
            isPremium: false,
            status: 'REGISTERED',
            proofUrl: firebase.firestore.FieldValue.delete(),
            proofPublicId: firebase.firestore.FieldValue.delete(),
            proofSentAt: firebase.firestore.FieldValue.delete()
        });
        alert("User berhasil dinonaktifkan!");
    } catch (err) {
        alert("Gagal menonaktifkan user: " + err.message);
    }
};

window.deleteUser = async (machineId) => {
    const userDoc = await db.collection('users').doc(machineId).get();
    const userData = userDoc.data();

    if (!confirm("HAPUS USER? Seluruh riwayat foto di Cloudinary juga akan dihapus permanen.")) return;

    try {
        // 1. Hapus seluruh riwayat foto di Cloudinary
        if (userData.proofHistory && Array.isArray(userData.proofHistory)) {
            for (const item of userData.proofHistory) {
                if (item.publicId) {
                    await deleteFromCloudinary(item.publicId);
                }
            }
        } else if (userData.proofPublicId) {
            // Fallback untuk user lama
            await deleteFromCloudinary(userData.proofPublicId);
        }

        await db.collection('users').doc(machineId).delete();
        alert("User dan seluruh riwayat foto berhasil dihapus!");
    } catch (err) {
        alert("Gagal menghapus user: " + err.message);
    }
};

// --- SETTINGS LOGIC ---
newQrInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        currentQrImg.src = URL.createObjectURL(file);
        currentQrImg.classList.remove('hidden');
        noQrMsg.classList.add('hidden');
        deleteQrBtn.classList.remove('hidden');
    }
});

async function loadSettings() {
    try {
        const doc = await db.collection('settings').doc('donation').get();
        if (doc.exists) {
            donationSettings = doc.data();
            donationLinkInput.value = donationSettings.link || '';
            updateMessageInput.value = donationSettings.updateMessage || '';
            if (updateMessageEnInput) updateMessageEnInput.value = donationSettings.updateMessageEn || '';
            updateLinkInput.value = donationSettings.updateLink || '';
            forceUpdateChk.checked = donationSettings.forceUpdate || false;
            trialDurationInput.value = donationSettings.trialDurationDays || 15;
            if (minVersionInput) minVersionInput.value = donationSettings.minVersion || '1.0.0';
            
            if (donationSettings.qrUrl) {
                currentQrImg.src = donationSettings.qrUrl;
                currentQrImg.classList.remove('hidden');
                noQrMsg.classList.add('hidden');
                deleteQrBtn.classList.remove('hidden');
            } else {
                currentQrImg.classList.add('hidden');
                noQrMsg.classList.remove('hidden');
                deleteQrBtn.classList.add('hidden');
            }
        }
    } catch (err) {
        console.error("Error loading settings:", err);
    }
}

saveSettingsBtn.addEventListener('click', async () => {
    const newLink = donationLinkInput.value;
    const newUpdateMsg = updateMessageInput.value;
    const newUpdateLink = updateLinkInput.value;
    const qrFile = newQrInput.files[0];

    try {
        saveSettingsBtn.disabled = true;
        saveSettingsBtn.textContent = qrFile ? "UPLOADING QR..." : "SAVING...";

        let finalQrUrl = donationSettings.qrUrl;
        let finalQrPublicId = donationSettings.qrPublicId;

        // Jika ada file baru diupload
        if (qrFile) {
            // Hapus yang lama jika ada
            if (donationSettings.qrPublicId) {
                await deleteFromCloudinary(donationSettings.qrPublicId);
            }

            // Upload baru (Unsigned)
            const formData = new FormData();
            formData.append("file", qrFile);
            formData.append("upload_preset", "buktidonasi");

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error("Cloudinary: " + (errorData.error ? errorData.error.message : "Upload failed"));
            }

            const data = await res.json();
            finalQrUrl = data.secure_url;
            finalQrPublicId = data.public_id;
        }

        const newUpdateMsgEn = updateMessageEnInput ? updateMessageEnInput.value : '';

        await db.collection('settings').doc('donation').set({
            qrUrl: finalQrUrl,
            qrPublicId: finalQrPublicId,
            link: newLink,
            updateMessage: newUpdateMsg,
            updateMessageEn: newUpdateMsgEn,
            updateLink: newUpdateLink,
            forceUpdate: forceUpdateChk.checked,
            minVersion: minVersionInput ? minVersionInput.value : '1.0.0',
            trialDurationDays: parseInt(trialDurationInput.value) || 15,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        donationSettings = { ...donationSettings, qrUrl: finalQrUrl, qrPublicId: finalQrPublicId, link: newLink };
        newQrInput.value = '';
        alert("Pengaturan Berhasil Disimpan!");
        loadSettings();
    } catch (err) {
        alert("Gagal menyimpan: " + err.message);
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = "SIMPAN PENGATURAN DONASI";
    }
});

const publishUpdateBtn = document.getElementById('publish-update-btn');
publishUpdateBtn.addEventListener('click', async () => {
    const newUpdateMsg = updateMessageInput.value;
    const newUpdateMsgEn = updateMessageEnInput ? updateMessageEnInput.value : '';
    const newUpdateLink = updateLinkInput.value;

    try {
        publishUpdateBtn.disabled = true;
        publishUpdateBtn.textContent = "PUBLISHING...";

        await db.collection('settings').doc('donation').set({
            updateMessage: newUpdateMsg,
            updateMessageEn: newUpdateMsgEn,
            updateLink: newUpdateLink,
            forceUpdate: forceUpdateChk.checked,
            minVersion: minVersionInput ? minVersionInput.value : '1.0.0',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("Update Aplikasi Berhasil Dipublikasikan!");
    } catch (err) {
        alert("Gagal mempublikasikan update: " + err.message);
    } finally {
        publishUpdateBtn.disabled = false;
        publishUpdateBtn.textContent = "PUBLIKASIKAN UPDATE SEKARANG";
    }
});

deleteQrBtn.addEventListener('click', async () => {
    if (!confirm("Hapus gambar QR dari sistem dan Cloudinary?")) return;

    try {
        if (donationSettings.qrPublicId) {
            await deleteFromCloudinary(donationSettings.qrPublicId);
        }

        await db.collection('settings').doc('donation').update({
            qrUrl: '',
            qrPublicId: firebase.firestore.FieldValue.delete()
        });

        alert("QR Berhasil Dihapus!");
        loadSettings();
    } catch (err) {
        alert("Gagal menghapus: " + err.message);
    }
});

// --- AUTO TRANSLATE LOGIC ---
const btnTranslateAuto = document.getElementById('btn-translate-auto');
if (updateMessageInput && updateMessageEnInput && btnTranslateAuto) {
    btnTranslateAuto.addEventListener('click', async () => {
        const text = updateMessageInput.value.trim();
        if (!text) return alert("Masukkan teks Indonesia terlebih dahulu!");

        try {
            btnTranslateAuto.disabled = true;
            btnTranslateAuto.textContent = "Translating...";
            updateMessageEnInput.placeholder = "Sedang menerjemahkan...";
            
            const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=en&dt=t&q=${encodeURIComponent(text)}`);
            const result = await response.json();
            
            if (result && result[0]) {
                const translated = result[0].map(x => x[0]).join("");
                updateMessageEnInput.value = translated;
            }
        } catch (error) {
            console.error("Auto-translate failed:", error);
            alert("Gagal menerjemahkan secara otomatis. Periksa koneksi internet.");
        } finally {
            btnTranslateAuto.disabled = false;
            btnTranslateAuto.textContent = "⬇️ TERJEMAHKAN KE INGGRIS (AUTO)";
            updateMessageEnInput.placeholder = "Example: Version 1.1 is out...";
        }
    });
}
