const https = require('https');
const http = require('http');

class GoogleAiHub {
  constructor() {
    this.baseUrl = 'generativelanguage.googleapis.com';
    this.apiVersion = 'v1beta';
  }

  // 1. Dynamic Model Discovery via official endpoint
  async discoverModels(apiKey) {
    return new Promise((resolve) => {
      if (!apiKey) return resolve({ success: false, error: 'API key is required.' });

      const options = {
        hostname: this.baseUrl,
        path: `/${this.apiVersion}/models?key=${apiKey}`,
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.error) {
              return resolve({ success: false, error: data.error.message, code: data.error.code });
            }

            const catalog = (data.models || []).map(m => {
              const id = m.name.replace('models/', '');
              const methods = m.supportedGenerationMethods || [];
              
              // Intelligent capability tagging
              const isVision = id.includes('flash') || id.includes('pro') || id.includes('omni') || id.includes('veo') || id.includes('vision');
              const isAudio = id.includes('audio') || id.includes('flash') || id.includes('pro');
              const isEmbedding = methods.includes('embedContent') || id.includes('embedding');
              const isVideoGen = id.includes('veo') || id.includes('omni');

              return {
                id,
                displayName: m.displayName || id,
                description: m.description || '',
                inputTokenLimit: m.inputTokenLimit || 0,
                outputTokenLimit: m.outputTokenLimit || 0,
                methods,
                capabilities: {
                  generateContent: methods.includes('generateContent'),
                  embedContent: isEmbedding,
                  videoUnderstanding: isVision,
                  audioUnderstanding: isAudio,
                  videoGeneration: isVideoGen
                },
                family: this.classifyFamily(id),
                status: 'Active (Official API)'
              };
            });

            resolve({ success: true, models: catalog, timestamp: Date.now() });
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse Google API response: ' + e.message });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.end();
    });
  }

  classifyFamily(modelId) {
    const id = modelId.toLowerCase();
    if (id.includes('veo')) return 'Veo Video';
    if (id.includes('imagen') || id.includes('banana')) return 'Image / Imagen';
    if (id.includes('embedding')) return 'Embedding';
    if (id.includes('gemma')) return 'Gemma Open Family';
    if (id.includes('flash-lite')) return 'Gemini Flash-Lite';
    if (id.includes('flash')) return 'Gemini Flash';
    if (id.includes('pro')) return 'Gemini Pro (Reasoning)';
    return 'Gemini Multimodal';
  }

  // 2. Multimodal Execution Router
  async executeTask({ apiKey, modelId, systemPrompt, userPrompt, mediaParts = [] }) {
    return new Promise((resolve) => {
      const parts = [{ text: userPrompt }];
      if (mediaParts && mediaParts.length > 0) {
        mediaParts.forEach(part => parts.push(part));
      }

      const body = JSON.stringify({
        contents: [{ parts }],
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });

      const options = {
        hostname: this.baseUrl,
        path: `/${this.apiVersion}/models/${modelId}:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) return resolve({ success: false, error: parsed.error.message });
            const textResponse = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const usage = parsed.usageMetadata || {};
            resolve({ success: true, text: textResponse, usage });
          } catch (e) {
            resolve({ success: false, error: 'JSON parse error: ' + e.message });
          }
        });
      });

      req.on('error', err => resolve({ success: false, error: err.message }));
      req.write(body);
      req.end();
    });
  }

  // 3. Local Gemma Model Adapter (Ollama / Local Runner compatible)
  async queryLocalGemma(prompt, endpoint = 'http://localhost:11434/api/generate') {
    return new Promise((resolve) => {
      try {
        const url = new URL(endpoint);
        const payload = JSON.stringify({ model: 'gemma:2b', prompt, stream: false });
        const options = {
          hostname: url.hostname,
          port: url.port || 11434,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        };

        const req = http.request(options, (res) => {
          let raw = '';
          res.on('data', chunk => raw += chunk);
          res.on('end', () => {
            try {
              const resJson = JSON.parse(raw);
              resolve({ success: true, text: resJson.response || raw });
            } catch (err) {
              resolve({ success: false, error: 'Local Gemma response error' });
            }
          });
        });

        req.on('error', () => {
          resolve({ success: false, error: 'Local Gemma offline. Run Ollama or local LLM runner.' });
        });
        req.write(payload);
        req.end();
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }
}

module.exports = new GoogleAiHub();
