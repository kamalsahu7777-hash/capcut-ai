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

    // 1. Main draft content file
    fs.writeFileSync(path.join(projectFolder, 'draft_content.json'), JSON.stringify(draftData, null, 2), 'utf-8');

    // 2. Draft Meta Info file (CapCut ko project show karne ke liye yeh zaroori hai)
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
