import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, RotateCcw, AlertCircle, Save } from "lucide-react";
import { getUserFriendlyMessage, ErrorCode } from '@/lib/errors';
import { toast } from 'sonner';

const LANGUAGES = [
    { value: "Auto-detect", label: "✨ Auto-detect" },
    { value: "English", label: "English" },
    { value: "Spanish", label: "Spanish" },
    { value: "French", label: "French" },
    { value: "German", label: "German" },
    { value: "Chinese", label: "Chinese" },
    { value: "Japanese", label: "Japanese" },
    { value: "Korean", label: "Korean" },
    { value: "Russian", label: "Russian" },
    { value: "Italian", label: "Italian" },
    { value: "Portuguese", label: "Portuguese" },
    { value: "Arabic", label: "Arabic" },
    { value: "Hindi", label: "Hindi" },
];

export default function TranslateTab() {
    const [sourceLang, setSourceLang] = useState("Auto-detect");
    const [targetLang, setTargetLang] = useState("English");
    const [status, setStatus] = useState("");
    const [isTranslating, setIsTranslating] = useState(false);
    const [isError, setIsError] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        chrome.storage.sync.get(['sourceLang', 'targetLang'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Storage error:', chrome.runtime.lastError);
                return;
            }
            const data = result as { sourceLang?: string; targetLang?: string };
            if (data.sourceLang) setSourceLang(data.sourceLang);
            if (data.targetLang) setTargetLang(data.targetLang);
        });
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        chrome.storage.sync.set({ sourceLang, targetLang }, () => {
            setIsSaving(false);
            if (chrome.runtime.lastError) {
                toast.error("Failed to save preferences");
                return;
            }
            toast.success("Language preferences saved!");
        });
    };

    const showStatus = (message: string, error = false) => {
        setStatus(message);
        setIsError(error);
    };

    const handleTranslate = async () => {
        setIsTranslating(true);
        setIsError(false);
        showStatus("Scanning page...");

        try {
            // Save language preferences
            await chrome.storage.sync.set({ sourceLang, targetLang });

            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                throw { code: ErrorCode.NO_ACTIVE_TAB };
            }

            // Check if we can run on this page
            const url = tab.url || '';
            if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
                showStatus("Cannot translate browser pages", true);
                return;
            }

            // Ping the content script to check if it's loaded
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            } catch {
                showStatus("Refresh the page and try again", true);
                return;
            }

            // Send translate message
            chrome.tabs.sendMessage(tab.id, {
                action: 'translate',
                source: sourceLang,
                target: targetLang
            });

            showStatus("Translation started!");
        } catch (error) {
            console.error('Translation error:', error);
            const message = getUserFriendlyMessage(error);
            showStatus(message, true);
        } finally {
            setTimeout(() => {
                setIsTranslating(false);
                if (!isError) {
                    setStatus("");
                }
            }, 2000);
        }
    };

    const handleRevert = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) {
                showStatus("No active tab", true);
                return;
            }

            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'revert' });
            } catch {
                showStatus("Nothing to revert", true);
                setTimeout(() => setStatus(""), 2000);
            }
        } catch (error) {
            console.error('Revert error:', error);
            showStatus("Failed to revert", true);
        }
    };

    return (
        <div className="space-y-4">
            {/* Source Language */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">Translate from</Label>
                <Select value={sourceLang} onValueChange={setSourceLang}>
                    <SelectTrigger className="w-full bg-[#18181b] border-[#27272a] text-white h-11 rounded-[10px] hover:border-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                        <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181b] border-blue-500 text-white rounded-[10px] shadow-2xl">
                        {LANGUAGES.map(lang => (
                            <SelectItem
                                key={lang.value}
                                value={lang.value}
                                className="focus:bg-[#27272a] focus:text-white data-[state=checked]:bg-blue-500/10 data-[state=checked]:text-blue-400"
                            >
                                {lang.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Target Language */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">Translate to</Label>
                <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger className="w-full bg-[#18181b] border-[#27272a] text-white h-11 rounded-[10px] hover:border-zinc-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all">
                        <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181b] border-blue-500 text-white rounded-[10px] shadow-2xl">
                        {LANGUAGES.filter(l => l.value !== "Auto-detect").map(lang => (
                            <SelectItem
                                key={lang.value}
                                value={lang.value}
                                className="focus:bg-[#27272a] focus:text-white data-[state=checked]:bg-blue-500/10 data-[state=checked]:text-blue-400"
                            >
                                {lang.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-3">
                <Button
                    onClick={handleTranslate}
                    disabled={isTranslating}
                    className="group w-full h-11 text-sm font-semibold rounded-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-white/10 transition-all duration-300"
                >
                    {isTranslating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {isTranslating ? "Translating..." : "Translate Page"}
                </Button>

                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full h-11 text-sm font-semibold rounded-[10px] bg-[#27272a] hover:bg-[#3f3f46] text-white border border-white/5 transition-all"
                >
                    {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSaving ? "Saving..." : "Save Settings"}
                </Button>

                <Button
                    variant="outline"
                    onClick={handleRevert}
                    className="w-full h-11 text-sm font-semibold rounded-[10px] bg-transparent border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
                >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Revert to Original
                </Button>
            </div>

            {/* Status */}
            {status && (
                <div className={`flex items-center justify-center gap-2 text-xs font-medium pt-2 animate-in fade-in-0 duration-300 ${isError ? 'text-red-400' : 'text-zinc-400'}`}>
                    {isError && <AlertCircle className="h-3 w-3" />}
                    {status}
                </div>
            )}
        </div>
    );
}

