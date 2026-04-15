const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

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
            contextIsolation: true
        },
        autoHideMenuBar: true,
        backgroundColor: '#0f172a'
    });

    mainWindow.loadFile('index.html');

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

ipcMain.handle('get-thumbnail', async (event, filePath) => {
    try {
        const thumbnail = await nativeImage.createThumbnailFromPath(filePath, { width: 40, height: 40 });
        return thumbnail.toDataURL();
    } catch (err) {
        return null;
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
