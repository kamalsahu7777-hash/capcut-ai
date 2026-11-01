const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
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

// 3 API Keys Save/Load Handlers
ipcMain.handle('save-google-keys', async (event, { keys }) => {
  try {
    const keysData = JSON.stringify(keys);
    let encrypted = keysData;
    if (safeStorage.isEncryptionAvailable()) {
      encrypted = safeStorage.encryptString(keysData).toString('base64');
      writeConfig({ googleKeysEnc: encrypted, isEnc: true });
    } else {
      writeConfig({ googleKeys: keys, isEnc: false });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-google-keys', async () => {
  try {
    const cfg = readConfig();
    if (cfg.isEnc && cfg.googleKeysEnc && safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(cfg.googleKeysEnc, 'base64');
      const decrypted = safeStorage.decryptString(buf);
      return { success: true, keys: JSON.parse(decrypted) };
    } else if (cfg.googleKeys) {
      return { success: true, keys: cfg.googleKeys };
    }
    return { success: true, keys: ['', '', ''] };
  } catch (err) {
    return { success: true, keys: ['', '', ''], error: err.message };
  }
});

ipcMain.handle('hub-discover-models', async (event, { apiKey }) => {
  return await googleAiHub.discoverModels(apiKey);
});

ipcMain.handle('hub-execute-task', async (event, payload) => {
  return await googleAiHub.executeTask(payload);
});

// AUTO DOWNLOAD VIA YT-DLP
ipcMain.handle('download-reference-video', async (event, { url }) => {
  return new Promise((resolve) => {
    if (!url) return resolve({ success: false, error: 'URL is missing.' });

    const tempDir = path.join(app.getPath('temp'), 'clipsync_downloads');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const outputTemplate = path.join(tempDir, '%(id)s.%(ext)s');
    const command = `yt-dlp -o "${outputTemplate}" "${url}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        return resolve({ 
          success: false, 
          error: 'yt-dlp download failed. Make sure yt-dlp is installed on your Windows PC path. Error: ' + error.message 
        });
      }

      try {
        const files = fs.readdirSync(tempDir).map(file => ({
          name: file,
          fullPath: path.join(tempDir, file),
          time: fs.statSync(path.join(tempDir, file)).mtimeMs
        })).sort((a, b) => b.time - a.time);

        if (files.length > 0) {
          const latestFile = files[0];
          const stats = fs.statSync(latestFile.fullPath);
          resolve({
            success: true,
            file: {
              name: latestFile.name,
              fullPath: latestFile.fullPath,
              sizeBytes: stats.size
            }
          });
        } else {
          resolve({ success: false, error: 'Downloaded file not found in temp directory.' });
        }
      } catch (err) {
        resolve({ success: false, error: 'File resolution error: ' + err.message });
      }
    });
  });
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

    // 1. Draft Content
    fs.writeFileSync(path.join(projectFolder, 'draft_content.json'), JSON.stringify(draftData, null, 2), 'utf-8');

    // 2. Draft Meta Info (CapCut display requirement)
    const metaInfo = {
      draft_name: cleanName,
      draft_id: cleanName + "_" + Date.now(),
      create_time: Math.floor(Date.now() / 1000),
      update_time: Math.floor(Date.now() / 1000),
      draft_version: "5.0.0",
      platform: { app_name: "capcut", os: "windows" }
    };
    fs.writeFileSync(path.join(projectFolder, 'draft_meta_info.json'), JSON.stringify(metaInfo, null, 2), 'utf-8');

    return {
      success: true,
      path: projectFolder,
      message: direct ? `Successfully injected into CapCut PC at: ${projectFolder}` : `Exported to Desktop: ${projectFolder}`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
