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
