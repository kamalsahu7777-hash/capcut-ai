// AUTO DOWNLOAD VIA YT-DLP INTEGRATION
ipcMain.handle('download-reference-video', async (event, { url }) => {
  return new Promise((resolve) => {
    if (!url) return resolve({ success: false, error: 'URL is missing.' });

    const tempDir = path.join(app.getPath('temp'), 'clipsync_downloads');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const outputTemplate = path.join(tempDir, '%(id)s.%(ext)s');
    
    // Updated command without strict format flag
    const command = `yt-dlp -o "${outputTemplate}" "${url}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        return resolve({ 
          success: false, 
          error: 'yt-dlp download failed. Error: ' + error.message 
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
