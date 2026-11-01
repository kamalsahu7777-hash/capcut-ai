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
              return resolve({ success: false, error: data.error.message });
            }

            const catalog = (data.models || []).map(m => {
              const id = m.name.replace('models/', '');
              const methods = m.supportedGenerationMethods || [];
              const isVision = id.includes('flash') || id.includes('pro') || id.includes('vision') || id.includes('gemini');

              return {
                id,
                displayName: m.displayName || id,
                methods,
                capabilities: {
                  generateContent: methods.includes('generateContent'),
                  videoUnderstanding: isVision
                }
              };
            });

            resolve({ success: true, models: catalog });
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.end();
    });
  }

  // MULTI-KEY SILENT FALLBACK EXECUTOR
  async executeTask({ apiKeys, modelId, systemPrompt, userPrompt }) {
    // Array filter out empty keys
    const validKeys = (apiKeys || []).filter(k => k && k.trim() !== '');
    if (validKeys.length === 0) {
      return { success: false, error: 'Kam se kam 1 valid Google API Key honi chahiye!' };
    }

    let lastError = '';

    // Loop through all provided keys silently
    for (let i = 0; i < validKeys.length; i++) {
      const currentKey = validKeys[i];
      let targetModel = modelId || 'gemini-1.5-flash';

      const result = await this.singleKeyExecution(currentKey, targetModel, systemPrompt, userPrompt);
      if (result.success) {
        return { ...result, usedKeyIndex: i + 1 }; // Successfully executed using key i+1
      } else {
        lastError = result.error;
        // Silent fallback: Continue to next key without showing alert to user
        console.warn(`Key #${i + 1} failed. Silently switching to next API key...`);
      }
    }

    // Agar teeno keys fail ho jayein tab hi error return karega
    return { success: false, error: 'Sabhi API keys try kar li gayi hain. Last error: ' + lastError };
  }

  async singleKeyExecution(apiKey, targetModel, systemPrompt, userPrompt) {
    return new Promise((resolve) => {
      const parts = [{ text: userPrompt }];
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
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('error', err => resolve({ success: false, error: err.message }));
      req.write(body);
      req.end();
    });
  }
}

module.exports = new GoogleAiHub();
