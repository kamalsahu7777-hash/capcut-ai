async discoverModels(apiKey) {
    return new Promise((resolve) => {
      if (!apiKey) return resolve({ success: false, error: 'API key is required.' });

      // Clean and encode the API key to prevent unescaped characters error
      const cleanKey = encodeURIComponent(apiKey.trim());

      const options = {
        hostname: this.baseUrl,
        path: `/${this.apiVersion}/models?key=${cleanKey}`,
        method: 'GET',
        timeout: 6000
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

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Connection timeout.' });
      });

      req.on('error', (err) => resolve({ success: false, error: err.message }));
      req.end();
    });
  }
