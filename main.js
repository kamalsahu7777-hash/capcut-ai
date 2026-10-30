const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#070a12',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.m4a', '.flac'];

function scanDirectory(dirPath, recursive = true, foundFiles = []) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory() && recursive) {
        scanDirectory(fullPath, recursive, foundFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.includes(ext) || AUDIO_EXTENSIONS.includes(ext)) {
          const stats = fs.statSync(fullPath);
          foundFiles.push({
            name: entry.name,
            fullPath: fullPath,
            sizeBytes: stats.size,
            ext: ext,
            type: VIDEO_EXTENSIONS.includes(ext) ? 'video' : 'audio',
            folderName: path.basename(dirPath),
            lastModified: stats.mtimeMs
          });
        }
      }
    }
  } catch (err) {
    console.error('Folder scan error:', err);
  }
  return foundFiles;
}

ipcMain.handle('select-folders', async (event, { includeSubfolders }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, folders: [] };
  }

  const scannedFolders = [];
  for (const folderPath of result.filePaths) {
    const files = scanDirectory(folderPath, includeSubfolders, []);
    scannedFolders.push({
      folderPath,
      folderName: path.basename(folderPath),
      files
    });
  }
  return { canceled: false, folders: scannedFolders };
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media Files', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'mp3', 'wav', 'aac'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true, files: [] };
  }

  const files = result.filePaths.map(fullPath => {
    const ext = path.extname(fullPath).toLowerCase();
    const stats = fs.statSync(fullPath);
    return {
      name: path.basename(fullPath),
      fullPath,
      sizeBytes: stats.size,
      ext,
      type: VIDEO_EXTENSIONS.includes(ext) ? 'video' : 'audio',
      folderName: path.basename(path.dirname(fullPath)),
      lastModified: stats.mtimeMs
    };
  });

  return { canceled: false, files };
});

ipcMain.handle('export-capcut-draft', async (event, { draftData, projectName }) => {
  try {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
    const capcutDraftBase = path.join(localAppData, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');

    let targetDir = capcutDraftBase;
    let injectedDirectly = true;

    if (!fs.existsSync(capcutDraftBase)) {
      targetDir = path.join(process.env.USERPROFILE, 'Desktop', 'ClipSync_CapCut_Projects');
      injectedDirectly = false;
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    }

    const cleanProjectName = (projectName || 'ClipSync_AutoProject').replace(/[^a-zA-Z0-9_-]/g, '_');
    const projectFolder = path.join(targetDir, cleanProjectName);
    if (!fs.existsSync(projectFolder)) fs.mkdirSync(projectFolder, { recursive: true });

    const draftFilePath = path.join(projectFolder, 'draft_content.json');
    fs.writeFileSync(draftFilePath, JSON.stringify(draftData, null, 2), 'utf-8');

    return {
      success: true,
      injectedDirectly,
      path: projectFolder,
      message: injectedDirectly 
        ? `Successfully injected into CapCut PC at: ${projectFolder}`
        : `CapCut folder not found. Exported project to Desktop: ${projectFolder}`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
