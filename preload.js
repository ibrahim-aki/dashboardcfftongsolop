const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getPortableStatus: () => ipcRenderer.invoke('get-portable-status'),
    selectFolders: () => ipcRenderer.invoke('select-folders'),
    startScan: (folders, excludes, isJunkScan) => ipcRenderer.send('start-scan', { folders, excludes, isJunkScan }),
    stopScan: () => ipcRenderer.send('stop-scan'),
    onScanProgress: (callback) => ipcRenderer.on('scan-progress', (event, data) => callback(data)),
    onScanDone: (callback) => ipcRenderer.on('scan-done', (event, data) => callback(data)),
    onGroupFound: (callback) => ipcRenderer.on('group-found', (event, data) => callback(data)),
    onScanError: (callback) => ipcRenderer.on('scan-error', (event, data) => callback(data)),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
    deleteFilePermanently: (filePath) => ipcRenderer.invoke('delete-file-permanently', filePath),
    openLocation: (filePath) => ipcRenderer.invoke('open-location', filePath),
    openUrl: (url) => ipcRenderer.invoke('open-url', url),
    getThumbnail: (path) => ipcRenderer.invoke('get-thumbnail', path),
    getJunkPaths: () => ipcRenderer.invoke('get-junk-paths')
});
