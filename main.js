const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

// --- CONFIG LOADER ---
// Development: pakai .env | Production (.exe): pakai firebase-config.js yang di-inject saat build
let firebaseConfig = {};
if (!app.isPackaged) {
    // Mode Development
    require('dotenv').config();
    firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
    };
} else {
    // Mode Production (.exe)
    try {
        firebaseConfig = require('./firebase-config.js');
    } catch (e) {
        console.error('firebase-config.js not found! Run npm run build properly.');
    }
}


let mainWindow;
let scanWorker = null;

// --- PORTABLE MODE LOGIC ---
function setupPortableMode() {
    const isDev = !app.isPackaged;
    if (isDev) return { portable: false };

    const exePath = path.dirname(process.execPath);
    const portableDataPath = path.join(exePath, 'app_data');

    try {
        if (!fs.existsSync(portableDataPath)) {
            fs.mkdirSync(portableDataPath, { recursive: true });
        }
        app.setPath('userData', portableDataPath);
        return { portable: true, path: portableDataPath };
    } catch (err) {
        return { portable: false, error: err.message };
    }
}

const portableInfo = setupPortableMode();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: !app.isPackaged // DevTools HANYA aktif di mode development
        },
        autoHideMenuBar: true,
        backgroundColor: '#0f172a'
    });

    mainWindow.loadFile('index.html');

    // --- SECURITY: Blokir DevTools di mode produksi ---
    if (app.isPackaged) {
        // 1. Cegah DevTools dibuka via kode
        mainWindow.webContents.on('devtools-opened', () => {
            mainWindow.webContents.closeDevTools();
        });

        // 2. Blokir shortcut keyboard berbahaya
        const { Menu } = require('electron');
        Menu.setApplicationMenu(null); // Hapus menu bar

        mainWindow.webContents.on('before-input-event', (event, input) => {
            // Blokir F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
            const isDevToolShortcut = (
                input.key === 'F12' ||
                (input.control && input.shift && ['i', 'I', 'j', 'J', 'c', 'C'].includes(input.key))
            );
            if (isDevToolShortcut) event.preventDefault();
        });

        // 3. Blokir klik kanan (Inspect Element)
        mainWindow.webContents.on('context-menu', (event) => {
            event.preventDefault();
        });
    } else {
        // Mode Development: DevTools tetap bebas
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        if (scanWorker) scanWorker.terminate();
        mainWindow = null;
    });
}

// Ensure app starts after setting userData path
app.whenReady().then(() => {
    createWindow();

    // Beritahukan status portabel ke renderer
    ipcMain.handle('get-portable-status', () => portableInfo);

    ipcMain.handle('get-junk-paths', () => {
        const junkFolders = [
            { id: 'TEMP_USER', name: 'Temp (User)', path: process.env.TEMP },
            { id: 'TEMP_SYS', name: 'Temp (System)', path: 'C:\\Windows\\Temp' },
            { id: 'PREFETCH', name: 'Prefetch', path: 'C:\\Windows\\Prefetch' },
            { id: 'KERNEL', name: 'Live Kernel Reports', path: 'C:\\Windows\\LiveKernelReports' },
            { id: 'RECYCLE', name: 'Recycle Bin (C:)', path: 'C:\\$Recycle.Bin' },
            { id: 'WER', name: 'Windows Error Reports', path: 'C:\\ProgramData\\Microsoft\\Windows\\WER' }
        ];

        // Filter valid paths only
        return junkFolders.filter(f => f.path && fs.existsSync(f.path));
    });
});

// --- IPC HANDLERS ---

ipcMain.handle('select-folders', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'multiSelections']
    });
    return result.filePaths;
});

ipcMain.on('start-scan', (event, { folders, excludes, isJunkScan }) => {
    if (scanWorker) scanWorker.terminate();

    scanWorker = new Worker(path.join(__dirname, 'worker.js'), {
        workerData: { folders, excludes, isJunkScan }
    });

    scanWorker.on('message', (msg) => {
        if (msg.type === 'progress') {
            mainWindow.webContents.send('scan-progress', msg.data);
        } else if (msg.type === 'group-found') {
            mainWindow.webContents.send('group-found', msg.data);
        } else if (msg.type === 'done') {
            mainWindow.webContents.send('scan-done', msg.data);
            scanWorker.terminate();
            scanWorker = null;
        } else if (msg.type === 'error') {
            mainWindow.webContents.send('scan-error', msg.data);
            scanWorker.terminate();
            scanWorker = null;
        }
    });

    scanWorker.on('error', (err) => {
        mainWindow.webContents.send('scan-error', err.message);
        scanWorker = null;
    });
});

ipcMain.on('stop-scan', () => {
    if (scanWorker) {
        scanWorker.terminate();
        scanWorker = null;
    }
});

ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        await shell.trashItem(filePath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('delete-file-permanently', async (event, filePath) => {
    try {
        fs.unlinkSync(filePath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('open-location', async (event, filePath) => {
    shell.showItemInFolder(filePath);
});

ipcMain.handle('open-url', async (event, url) => {
    shell.openExternal(url);
});

ipcMain.handle('get-machine-id', async () => {
    try {
        const { execSync } = require('child_process');
        const output = execSync('wmic csproduct get uuid').toString();
        // Format output: UUID \n xxxxxxxx-xxxx-...
        const uuid = output.split('\n')[1].trim();
        return uuid || 'UNKNOWN_DEVICE';
    } catch (err) {
        console.error('Error getting machine id:', err);
        return 'UNKNOWN_DEVICE_' + Math.random().toString(36).substring(7);
    }
});

ipcMain.handle('get-thumbnail', async (event, filePath) => {
    try {
        const thumbnail = await nativeImage.createThumbnailFromPath(filePath, { width: 40, height: 40 });
        return thumbnail.toDataURL();
    } catch (err) {
        return null;
    }
});

ipcMain.handle('get-firebase-config', () => {
    return firebaseConfig;
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
