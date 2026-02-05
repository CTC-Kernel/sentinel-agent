const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { checkCallableRateLimit } = require('../utils/rateLimiter');

const geminiApiKey = defineSecret('GEMINI_API_KEY');

exports.geminiProxy = onCall(
  {
    region: 'europe-west1',
    secrets: [geminiApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
    enforceAppCheck: true
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // Rate limiting: AI operations use the 'heavy' preset (5 req/min)
    await checkCallableRateLimit(request, 'heavy');

    const { prompt, model, maxTokens, temperature } = request.data;
    if (!prompt || typeof prompt !== 'string') {
      throw new HttpsError('invalid-argument', 'Prompt is required');
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Gemini API key not configured');
    }

    // Validate model against allowlist to prevent arbitrary API endpoint access
    const ALLOWED_MODELS = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-3-pro-preview',
      'gemini-3-flash-preview',
    ];
    const modelId = model || 'gemini-2.0-flash';
    if (!ALLOWED_MODELS.includes(modelId)) {
      throw new HttpsError('invalid-argument', `Model "${modelId}" is not allowed. Use one of: ${ALLOWED_MODELS.join(', ')}`);
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens || 2048,
            temperature: temperature || 0.7,
          }
        })
      });

      if (!response.ok) {
        logger.error('Gemini API error', { status: response.status });
        throw new HttpsError('internal', 'AI service temporarily unavailable');
      }

      const data = await response.json();
      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        model: modelId
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Gemini proxy error', { error: error.message });
      throw new HttpsError('internal', 'AI service temporarily unavailable');
    }
  }
);
