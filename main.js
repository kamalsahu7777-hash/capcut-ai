// 1. Safe Credential Store for 3 API Keys
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
