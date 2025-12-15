/// <reference types="chrome" />

import { TranslationError, ErrorCode } from '@/lib/errors';
import { fetchGemini } from './providers/gemini';
import { fetchGrok } from './providers/grok';
import { fetchOpenAI } from './providers/openai';

export async function callAI(
    textArray: string[],
    source: string,
    target: string,
    model: string,
    gemKey: string,
    grokKey: string,
    openaiKey: string
): Promise<string[]> {
    const isGrok = model && model.startsWith('grok');
    const isOpenAI = model && model.startsWith('gpt');

    if (isGrok && !grokKey) {
        throw new TranslationError(ErrorCode.GROK_API_KEY_MISSING);
    }
    if (isOpenAI && !openaiKey) {
        throw new TranslationError(ErrorCode.OPENAI_API_KEY_MISSING);
    }
    if (!isGrok && !isOpenAI && !gemKey) {
        throw new TranslationError(ErrorCode.GEMINI_API_KEY_MISSING);
    }

    const systemPrompt = `
        You are a translation engine. 
        Input: A JSON array of strings.
        Task: Translate each string from ${source} to ${target}.
        Output: A strictly valid JSON array of strings. 
        Rules: 
        1. Maintain the exact order. 
        2. Do not include conversational text, markdown formatting, or code blocks (no \`\`\`json).
        3. Just the raw JSON array.
    `.trim();

    const userPrompt = JSON.stringify(textArray);

    if (isGrok) {
        return await fetchGrok(grokKey, model, systemPrompt, userPrompt);
    } else if (isOpenAI) {
        return await fetchOpenAI(openaiKey, model, systemPrompt, userPrompt);
    } else {
        return await fetchGemini(gemKey, model || 'models/gemini-2.5-flash', systemPrompt, userPrompt);
    }
}
