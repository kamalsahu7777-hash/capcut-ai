const https = require('https');
const http = require('http');

class GoogleAiHub {
  constructor() {
    this.baseUrl = 'generativelanguage.googleapis.com';
    this.apiVersion = 'v1beta';
  }

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
              const isVision = id.includes('flash') || id.includes('pro') || id.includes('vision');
              const isEmbedding = methods.includes('embedContent') || id.includes('embedding');

              return {
                id,
                displayName: m.displayName || id,
                description: m.description || '',
                inputTokenLimit: m.inputTokenLimit || 0,
                methods,
                capabilities: {
                  generateContent: methods.includes('generateContent'),
                  embedContent: isEmbedding,
                  videoUnderstanding: isVision
                },
                family: this.classifyFamily(id),
                status: 'Active'
              };
            });

            resolve({ success: true, models: catalog, timestamp: Date.now() });
          } catch (e) {
            resolve({ success: false, error: 'Parse error: ' + e.message });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.end();
    });
  }

  classifyFamily(modelId) {
    const id = modelId.toLowerCase();
    if (id.includes('embedding')) return 'Embedding';
    if (id.includes('pro')) return 'Gemini Pro';
    return 'Gemini Flash';
  }

  async executeTask({ apiKey, modelId, systemPrompt, userPrompt, mediaParts = [] }) {
    let targetModel = modelId;
    
    // Agar modelId pass nahi hua ya purana/deprecated hai, toh live list se pehla active model nikal lo
    if (!targetModel || targetModel.includes('2.5') || targetModel.includes('3.8') || targetModel.includes('1.5')) {
      const discovery = await this.discoverModels(apiKey);
      if (discovery.success && discovery.models.length > 0) {
        const validModel = discovery.models.find(m => m.capabilities.generateContent && m.capabilities.videoUnderstanding);
        if (validModel) {
          targetModel = validModel.id;
        } else {
          targetModel = discovery.models[0].id;
        }
      }
    }
    if (!targetModel) targetModel = 'gemini-pro';

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
        path: `/${this.apiVersion}/models/${targetModel}:generateContent?key=${apiKey}`,
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
            resolve({ success: true, text: textResponse, usage, usedModel: targetModel });
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

  async queryLocalGemma(prompt, endpoint = 'http://localhost:11434/api/generate') {
    return { success: false, error: 'Local offline' };
  }
}

module.exports = new GoogleAiHub();
