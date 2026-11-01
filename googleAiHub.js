async singleKeyExecution(apiKey, targetModel, systemPrompt, userPrompt, responseMimeType = null) {
  let activeModel = targetModel || 'gemini-2.5-flash';

  return new Promise((resolve) => {
    // 1. Payload structure according to official Gemini API spec
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    };

    // Dedicated system instruction if provided
    if (systemPrompt && systemPrompt.trim()) {
      payload.system_instruction = {
        parts: [{ text: systemPrompt.trim() }]
      };
    }

    // Dynamic mime type (agar JSON chahiye toh dynamically set karein)
    if (responseMimeType) {
      payload.generationConfig.responseMimeType = responseMimeType;
    }

    const body = JSON.stringify(payload);
    const cleanKey = encodeURIComponent(apiKey.trim());

    const options = {
      hostname: this.baseUrl || 'generativelanguage.googleapis.com',
      path: `/${this.apiVersion || 'v1beta'}/models/${activeModel}:generateContent?key=${cleanKey}`,
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

          // API Error handling
          if (parsed.error) {
            return resolve({
              success: false,
              error: parsed.error.message || 'Gemini API Error',
              code: parsed.error.code
            });
          }

          const candidate = parsed.candidates?.[0];
          const finishReason = candidate?.finishReason;

          // Check if blocked by safety or other filters
          if (finishReason && finishReason !== 'STOP') {
            if (!candidate.content) {
              return resolve({
                success: false,
                error: `Generation stopped due to: ${finishReason}`,
                finishReason
              });
            }
          }

          const textResponse = candidate?.content?.parts?.[0]?.text || '';
          const usage = parsed.usageMetadata || {};

          resolve({
            success: true,
            text: textResponse,
            usage,
            usedModel: activeModel,
            finishReason
          });
        } catch (e) {
          resolve({
            success: false,
            error: `JSON Parse error: ${e.message}`,
            rawResponse: raw
          });
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
