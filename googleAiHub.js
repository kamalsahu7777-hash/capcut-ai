async singleKeyExecution(apiKey, targetModel, systemPrompt, userPrompt) {
    // Jo model frontend se aaya hai, wahi use hoga (koi hardcoding nahi)
    let activeModel = targetModel || 'gemini-2.5-flash';

    return new Promise((resolve) => {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\nTask: ${userPrompt}` : userPrompt;
      const parts = [{ text: fullPrompt }];

      const body = JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });

      const cleanKey = encodeURIComponent(apiKey.trim());
      const options = {
        hostname: this.baseUrl,
        path: `/${this.apiVersion}/models/${activeModel}:generateContent?key=${cleanKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 45000
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
            resolve({ success: true, text: textResponse, usage, usedModel: activeModel });
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'AI Request timeout (45s exceeded).' });
      });

      req.on('error', err => resolve({ success: false, error: err.message }));
      req.write(body);
      req.end();
    });
  }
