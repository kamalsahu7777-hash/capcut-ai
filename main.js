const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const googleAiHub = require('./googleAiHub');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1550,
    height: 980,
    minWidth: 1250,
    minHeight: 820,
    backgroundColor: '#05070d',
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

const CONFIG_FILE = path.join(app.getPath('userData'), 'clipsync_ecosystem_config.json');

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Config read error:', e);
  }
  return {};
}

function writeConfig(data) {
  try {
    const current = readConfig();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...data }, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

ipcMain.handle('save-google-key', async (event, { apiKey }) => {
  try {
    let encrypted = apiKey;
    if (safeStorage.isEncryptionAvailable()) {
      encrypted = safeStorage.encryptString(apiKey).toString('base64');
      writeConfig({ googleKeyEnc: encrypted, isEnc: true });
    } else {
      writeConfig({ googleKey: apiKey, isEnc: false });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-google-key', async () => {
  try {
    const cfg = readConfig();
    if (cfg.isEnc && cfg.googleKeyEnc && safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(cfg.googleKeyEnc, 'base64');
      return { success: true, apiKey: safeStorage.decryptString(buf) };
    } else if (cfg.googleKey) {
      return { success: true, apiKey: cfg.googleKey };
    }
    return { success: true, apiKey: '' };
  } catch (err) {
    return { success: false, apiKey: '', error: err.message };
  }
});

ipcMain.handle('hub-discover-models', async (event, { apiKey }) => {
  return await googleAiHub.discoverModels(apiKey);
});

ipcMain.handle('hub-execute-task', async (event, payload) => {
  // Safe default model fallback for all accounts
  if (!payload.modelId || payload.modelId.includes('2.5') || payload.modelId.includes('3.8')) {
    payload.modelId = 'gemini-1.5-flash';
  }
  return await googleAiHub.executeTask(payload);
});

ipcMain.handle('hub-query-gemma', async (event, { prompt, endpoint }) => {
  return await googleAiHub.queryLocalGemma(prompt, endpoint);
});

ipcMain.handle('launch-google-flow', async () => {
  shell.openExternal('https://labs.google/flow');
  return { success: true, message: 'Google Flow Studio opened in browser.' };
});

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
    console.error('Scan error:', err);
  }
  return foundFiles;
}

ipcMain.handle('select-folders', async (event, { includeSubfolders }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections']
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true, folders: [] };

  const scanned = [];
  for (const fp of result.filePaths) {
    const files = scanDirectory(fp, includeSubfolders, []);
    scanned.push({ folderPath: fp, folderName: path.basename(fp), files });
  }
  return { canceled: false, folders: scanned };
});

ipcMain.handle('select-reference-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'webm'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  const fullPath = result.filePaths[0];
  const stats = fs.statSync(fullPath);
  return {
    canceled: false,
    file: { name: path.basename(fullPath), fullPath, sizeBytes: stats.size }
  };
});

ipcMain.handle('export-capcut-draft', async (event, { draftData, projectName }) => {
  try {
    const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
    const capcutDraftBase = path.join(localAppData, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');

    let targetDir = capcutDraftBase;
    let direct = true;

    if (!fs.existsSync(capcutDraftBase)) {
      targetDir = path.join(process.env.USERPROFILE, 'Desktop', 'ClipSync_CapCut_Projects');
      direct = false;
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    }

    const cleanName = (projectName || 'ClipSync_GoogleVFX').replace(/[^a-zA-Z0-9_-]/g, '_');
    const projectFolder = path.join(targetDir, cleanName);
    if (!fs.existsSync(projectFolder)) fs.mkdirSync(projectFolder, { recursive: true });

    fs.writeFileSync(path.join(projectFolder, 'draft_content.json'), JSON.stringify(draftData, null, 2), 'utf-8');

    return {
      success: true,
      path: projectFolder,
      message: direct ? `Successfully injected into CapCut PC at: ${projectFolder}` : `Exported to Desktop: ${projectFolder}`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
