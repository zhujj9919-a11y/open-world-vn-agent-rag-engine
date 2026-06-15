import express from 'express';

import { SECRET_KEYS, readSecret } from './secrets.js';

export const router = express.Router();

const MIMO_TTS_URL = 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions';

router.post('/generate', async (request, response) => {
    try {
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.CUSTOM, request.body.secret_id);
        if (!apiKey) {
            return response.status(400).json({ error: 'MiMo API key is not configured.' });
        }

        const text = String(request.body.text || '').trim();
        const voicePrompt = String(request.body.voicePrompt || '').trim();
        const voice = String(request.body.voice || '').trim();
        const model = String(request.body.model || (voice ? 'mimo-v2.5-tts' : 'mimo-v2.5-tts-voicedesign'));

        if (!text) {
            return response.status(400).json({ error: 'Text is required.' });
        }

        if (/voicedesign/i.test(model) && !voicePrompt) {
            return response.status(400).json({ error: 'voicePrompt is required for MiMo voice design TTS.' });
        }

        const audio = {
            format: 'wav',
            ...(request.body.audio || {}),
        };
        if (voice) {
            audio.voice = voice;
            delete audio.optimize_text_preview;
        } else if (/voicedesign/i.test(model)) {
            audio.optimize_text_preview = audio.optimize_text_preview ?? true;
        }

        const messages = [];
        if (voicePrompt) {
            messages.push({ role: 'user', content: voicePrompt });
        } else {
            messages.push({ role: 'user', content: '保持自然、清晰、贴合角色语境的中文表演。' });
        }
        messages.push({ role: 'assistant', content: text });

        const upstream = await fetch(MIMO_TTS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey,
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                audio,
                temperature: Number(request.body.temperature ?? 1),
                top_p: Number(request.body.top_p ?? 0.95),
                stream: false,
            }),
        });

        const payloadText = await upstream.text();
        let payload;
        try {
            payload = JSON.parse(payloadText);
        } catch {
            payload = { raw: payloadText };
        }

        if (!upstream.ok) {
            return response.status(upstream.status).json({
                error: payload?.error?.message || upstream.statusText || 'MiMo TTS request failed.',
                detail: payload,
            });
        }

        const audioData = payload?.choices?.[0]?.message?.audio?.data || payload?.audio?.data;
        if (!audioData) {
            return response.status(502).json({ error: 'MiMo TTS response did not include audio data.', detail: payload });
        }

        return response.json({
            audio: {
                format: audio.format || 'wav',
                data: audioData,
            },
            model,
            voice: voice || audio.voice || null,
        });
    } catch (error) {
        console.error('MiMo TTS proxy failed:', error);
        return response.status(500).json({ error: error.message || 'MiMo TTS proxy failed.' });
    }
});
