/// <reference types="chrome" />

import {
    TranslationError,
    ErrorCode,
    safeJsonParse,
    getErrorCodeFromStatus
} from '@/lib/errors';

// OpenAI-specific limit: smaller batches to prevent truncation
const OPENAI_MAX_ITEMS_PER_BATCH = 20;

/**
 * Extract JSON array from potentially messy LLM output
 */
function extractJsonArray(text: string): string {
    // Remove markdown code blocks
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Try to find a JSON array in the text
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        return arrayMatch[0];
    }

    return cleaned;
}

/**
 * Fetch a single batch from OpenAI
 */
async function fetchOpenAIBatch(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
): Promise<string[]> {
    let resp: Response;
    try {
        resp = await fetch('https://api.openai.com/v1/chat/completions', {
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
                reasoning_effort: 'low',
            }),
        });
    } catch (e) {
        throw new TranslationError(ErrorCode.NETWORK_ERROR, 'Failed to connect to OpenAI API', e);
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
        console.error('OpenAI response structure:', JSON.stringify(data, null, 2));
        throw new TranslationError(ErrorCode.INVALID_RESPONSE, 'No content in OpenAI response');
    }

    const jsonText = extractJsonArray(content);

    try {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) {
            console.error('OpenAI returned non-array:', typeof parsed, jsonText.substring(0, 200));
            throw new TranslationError(ErrorCode.INVALID_RESPONSE, 'Expected array, got ' + typeof parsed);
        }
        return parsed as string[];
    } catch (e) {
        console.error('OpenAI parse error. Raw content:', content.substring(0, 500));
        throw new TranslationError(ErrorCode.JSON_PARSE_ERROR, 'Invalid JSON response', e);
    }
}

/**
 * Main entry point - chunks large batches for OpenAI
 */
export async function fetchOpenAI(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
): Promise<string[]> {
    const inputArray: string[] = JSON.parse(userPrompt);

    // If small enough, send directly
    if (inputArray.length <= OPENAI_MAX_ITEMS_PER_BATCH) {
        return fetchOpenAIBatch(apiKey, model, systemPrompt, userPrompt);
    }

    // Chunk large batches
    const results: string[] = [];
    for (let i = 0; i < inputArray.length; i += OPENAI_MAX_ITEMS_PER_BATCH) {
        const chunk = inputArray.slice(i, i + OPENAI_MAX_ITEMS_PER_BATCH);
        const chunkPrompt = JSON.stringify(chunk);
        const chunkResults = await fetchOpenAIBatch(apiKey, model, systemPrompt, chunkPrompt);

        if (chunkResults.length !== chunk.length) {
            throw new TranslationError(
                ErrorCode.RESPONSE_MISMATCH,
                `OpenAI chunk: sent ${chunk.length}, got ${chunkResults.length}`
            );
        }

        results.push(...chunkResults);
    }

    return results;
}
