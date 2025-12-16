/// <reference types="chrome" />

import {
    TranslationError,
    ErrorCode,
    safeJsonParse,
    getErrorCodeFromStatus
} from '@/lib/errors';

export async function fetchGemini(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
): Promise<string[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [{ text: systemPrompt + '\n\nInput:\n' + userPrompt }],
            },
        ],
        generationConfig: {
            responseMimeType: 'application/json',
        },
    };

    let resp: Response;
    try {
        resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        throw new TranslationError(ErrorCode.NETWORK_ERROR, 'Failed to connect to Gemini API', e);
    }

    if (!resp.ok) {
        const errorBody = await resp.text().catch(() => '');
        const errorData = safeJsonParse<{ error?: { message?: string; status?: string } }>(errorBody, {});
        const errorMessage = errorData.error?.message || `HTTP ${resp.status}`;
        const errorCode = getErrorCodeFromStatus(resp.status);
        throw new TranslationError(errorCode, errorMessage);
    }

    const data = await resp.json();

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText === undefined || rawText === null) {
        const blockReason = data.candidates?.[0]?.finishReason;
        if (blockReason && blockReason !== 'STOP') {
            throw new TranslationError(ErrorCode.API_ERROR, `Response blocked: ${blockReason}`);
        }
        throw new TranslationError(ErrorCode.INVALID_RESPONSE, 'No translation text in response');
    }

    return safeJsonParse<string[]>(rawText, []);
}

/**
 * Streaming version of fetchGemini
 * Calls onChunk with each text delta as it arrives
 */
export async function fetchGeminiStream(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    onChunk: (text: string) => void
): Promise<void> {
    const url = `https://generativelanguage.googleapis.com/v1beta/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const payload = {
        contents: [
            {
                role: 'user',
                parts: [{ text: systemPrompt + '\n\nInput:\n' + userPrompt }],
            },
        ],
        generationConfig: {
            responseMimeType: 'application/json',
        },
    };

    let resp: Response;
    try {
        resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        throw new TranslationError(ErrorCode.NETWORK_ERROR, 'Failed to connect to Gemini API', e);
    }

    if (!resp.ok) {
        const errorBody = await resp.text().catch(() => '');
        const errorData = safeJsonParse<{ error?: { message?: string; status?: string } }>(errorBody, {});
        const errorMessage = errorData.error?.message || `HTTP ${resp.status}`;
        const errorCode = getErrorCodeFromStatus(resp.status);
        throw new TranslationError(errorCode, errorMessage);
    }

    if (!resp.body) {
        throw new TranslationError(ErrorCode.INVALID_RESPONSE, 'No response body for streaming');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            // Parse SSE format: "data: {...}\n\n"
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr && jsonStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(jsonStr);
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (text) {
                                onChunk(text);
                            }
                        } catch {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}
