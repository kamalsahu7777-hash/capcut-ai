import React, { useState } from 'react';

export default function RenderDashboard() {
  const [queue, setQueue] = useState([
    { id: '1', name: 'ClipSync_Project_1.mp4', status: 'queued', progress: 0 }
  ]);
  const [currentVideo, setCurrentVideo] = useState(null);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#111827', color: '#fff', padding: '20px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
      {/* Left: In-App Video Player Preview */}
      <div style={{ width: '65%', display: 'flex', flexDirection: 'column', paddingRight: '20px', borderRight: '1px solid #374151' }}>
        <h2 style={{ marginBottom: '15px' }}>ClipSync Preview Player</h2>
        <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {currentVideo ? (
            <video src={currentVideo} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <p style={{ color: '#9ca3af' }}>Select a rendered video to preview</p>
          )}
        </div>
      </div>

      {/* Right: Render Queue Manager */}
      <div style={{ width: '35%', paddingLeft: '20px', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: '15px' }}>Render Queue ({queue.length})</h2>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {queue.map((job) => (
            <div key={job.id} style={{ backgroundColor: '#1f2937', padding: '15px', borderRadius: '8px', border: '1px solid #374151' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{job.name}</span>
                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ca8a04' }}>
                  {job.status}
                </span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#374151', height: '8px', borderRadius: '4px', marginBottom: '10px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#6366f1', height: '100%', width: `${job.progress || 0}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', alignItems: 'center' }}>
                <span>{job.progress || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
