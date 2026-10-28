import React, { useState } from 'react';

export default function App() {
  const [apiKey1, setApiKey1] = useState(localStorage.getItem('clipsync_key1') || '');
  const [apiKey2, setApiKey2] = useState(localStorage.getItem('clipsync_key2') || '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('clipsync_key1', apiKey1);
    localStorage.setItem('clipsync_key2', apiKey2);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', background: '#090d16', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#6366f1' }}>ClipSync AI — Windows Desktop</h1>
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>AI Video Editing Assistant with CapCut Workflow Replication</p>

      <div style={{ marginTop: '24px', background: '#131826', padding: '20px', borderRadius: '10px', maxWidth: '600px', border: '1px solid #1e293b' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '16px', color: '#f1f5f9' }}>Configure Your AI API Keys</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
            Primary AI Key (Chat, Instructions & Plan Engine):
          </label>
          <input
            type="password"
            value={apiKey1}
            onChange={(e) => setApiKey1(e.target.value)}
            placeholder="Paste your Primary API key here..."
            style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#090d16', border: '1px solid #334155', color: '#fff', fontSize: '13px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
            Secondary AI Key (Video Analysis / Scene Extraction):
          </label>
          <input
            type="password"
            value={apiKey2}
            onChange={(e) => setApiKey2(e.target.value)}
            placeholder="Paste your Secondary API key here..."
            style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#090d16', border: '1px solid #334155', color: '#fff', fontSize: '13px' }}
          />
        </div>

        <button
          onClick={handleSave}
          style={{ padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Save API Keys
        </button>

        {saved && (
          <span style={{ marginLeft: '14px', color: '#10b981', fontSize: '13px' }}>
            ✓ Keys securely saved locally on your PC!
          </span>
        )}
      </div>
    </div>
  );
}
