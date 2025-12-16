/// <reference types="chrome" />

import {
    TranslationError,
    ErrorCode,
    safeJsonParse,
    getErrorCodeFromStatus
} from '@/lib/errors';

export async function fetchGrok(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
): Promise<string[]> {
    let resp: Response;
    try {
        resp = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
            }),
        });
    } catch (e) {
        throw new TranslationError(ErrorCode.NETWORK_ERROR, 'Failed to connect to Grok API', e);
    }

    if (!resp.ok) {
        const errorBody = await resp.text().catch(() => '');
        const errorData = safeJsonParse<{ error?: { message?: string } }>(errorBody, {});
        const errorMessage = errorData.error?.message || `HTTP ${resp.status}`;
        const errorCode = getErrorCodeFromStatus(resp.status);
        throw new TranslationError(errorCode, errorMessage);
    }

    const data = await resp.json();

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new TranslationError(ErrorCode.INVALID_RESPONSE, 'No content in Grok response');
    }

    const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();

    return safeJsonParse<string[]>(cleanedContent);
}

/**
 * Streaming version of fetchGrok
 * Calls onChunk with each text delta as it arrives
 */
export async function fetchGrokStream(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    onChunk: (text: string) => void
): Promise<void> {
    let resp: Response;
    try {
        resp = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.1,
                stream: true,
            }),
        });
    } catch (e) {
        throw new TranslationError(ErrorCode.NETWORK_ERROR, 'Failed to connect to Grok API', e);
    }

    if (!resp.ok) {
        const errorBody = await resp.text().catch(() => '');
        const errorData = safeJsonParse<{ error?: { message?: string } }>(errorBody, {});
        const errorMessage = errorData.error?.message || `HTTP ${resp.status}`;
        const errorCode = getErrorCodeFromStatus(resp.status);
        throw new TranslationError(errorCode, errorMessage);
    }

    if (!resp.body) {
        throw new TranslationError(ErrorCode.INVALID_RESPONSE, 'No response body for streaming');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr && jsonStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(jsonStr);
                            const content = data.choices?.[0]?.delta?.content;
                            if (content) {
                                onChunk(content);
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
