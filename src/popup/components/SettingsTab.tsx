import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Save, Trash2, Loader2 } from 'lucide-react';

export default function SettingsTab() {
    const [model, setModel] = useState("models/gemini-2.5-flash");
    const [geminiKey, setGeminiKey] = useState("");
    const [grokKey, setGrokKey] = useState("");
    const [openaiKey, setOpenaiKey] = useState("");
    const [autoSites, setAutoSites] = useState("");
    const [selectionPopupEnabled, setSelectionPopupEnabled] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    useEffect(() => {
        chrome.storage.sync.get(['selectedModel', 'geminiApiKey', 'grokApiKey', 'openaiApiKey', 'autoSites', 'selectionPopupEnabled'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to load settings:', chrome.runtime.lastError);
                toast.error("Failed to load settings");
                return;
            }
            const data = result as { selectedModel?: string; geminiApiKey?: string; grokApiKey?: string; openaiApiKey?: string; autoSites?: string; selectionPopupEnabled?: boolean };
            if (data.selectedModel) setModel(data.selectedModel);
            if (data.geminiApiKey) setGeminiKey(data.geminiApiKey);
            if (data.grokApiKey) setGrokKey(data.grokApiKey);
            if (data.openaiApiKey) setOpenaiKey(data.openaiApiKey);
            if (data.autoSites) setAutoSites(data.autoSites);
            if (data.selectionPopupEnabled !== undefined) setSelectionPopupEnabled(data.selectionPopupEnabled);
        });
    }, []);

    const handleSave = () => {
        setIsSaving(true);
        chrome.storage.sync.set({
            selectedModel: model,
            geminiApiKey: geminiKey,
            grokApiKey: grokKey,
            openaiApiKey: openaiKey,
            autoSites: autoSites,
            selectionPopupEnabled: selectionPopupEnabled
        }, () => {
            setIsSaving(false);
            if (chrome.runtime.lastError) {
                console.error('Save error:', chrome.runtime.lastError);
                toast.error("Failed to save settings");
                return;
            }
            toast.success("Settings saved!");
        });
    };

    const handleClearCache = () => {
        setIsClearing(true);
        try {
            chrome.runtime.sendMessage({ action: 'clearCache' }, (response) => {
                setIsClearing(false);
                if (chrome.runtime.lastError) {
                    console.error('Clear cache error:', chrome.runtime.lastError);
                    toast.error("Failed to clear cache");
                    return;
                }
                if (response) {
                    toast.success("Cache cleared.");
                } else {
                    toast.error("Failed to clear cache");
                }
            });
        } catch (error) {
            setIsClearing(false);
            console.error('Clear cache exception:', error);
            toast.error("Failed to clear cache");
        }
    };

    return (
        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {/* AI Model */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">AI Model</Label>
                <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="w-full bg-[#18181b] border-[#27272a] text-white h-11 rounded-[10px] hover:border-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all">
                        <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#18181b] border-violet-500 text-white rounded-[10px] shadow-2xl max-h-[280px]">
                        <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-2 py-1.5">OpenAI Models</SelectLabel>
                            <SelectItem value="gpt-5-nano" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">GPT-5 Nano</SelectItem>
                            <SelectItem value="gpt-5-mini" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">GPT-5 Mini</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-2 py-1.5 border-t border-zinc-800 mt-1">xAI Models (Grok)</SelectLabel>
                            <SelectItem value="grok-4" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Grok 4 (Reasoning)</SelectItem>
                            <SelectItem value="grok-4-fast" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Grok 4 Fast (Reasoning)</SelectItem>
                            <SelectItem value="grok-4-fast-non-reasoning" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Grok 4 Fast (Non-Reasoning)</SelectItem>
                            <SelectItem value="grok-4-1-fast-reasoning" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Grok 4.1 Fast Reasoning</SelectItem>
                            <SelectItem value="grok-4-1-fast-non-reasoning" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Grok 4.1 Fast</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-2 py-1.5 border-t border-zinc-800 mt-1">Gemini 2.5</SelectLabel>
                            <SelectItem value="models/gemini-2.5-pro" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Gemini 2.5 Pro</SelectItem>
                            <SelectItem value="models/gemini-2.5-flash" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Gemini 2.5 Flash</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-2 py-1.5 border-t border-zinc-800 mt-1">Gemma 3</SelectLabel>
                            <SelectItem value="models/gemma-3-27b-it" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Gemma 3 27B IT</SelectItem>
                            <SelectItem value="models/gemma-3-12b-it" className="focus:bg-[#27272a] data-[state=checked]:bg-violet-500/10 data-[state=checked]:text-violet-400">Gemma 3 12B IT</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            {/* Gemini API Key */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">Gemini API Key</Label>
                <Input
                    type="password"
                    placeholder="Enter AI Studio Key"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="bg-[#18181b] border-[#27272a] text-white h-11 rounded-[10px] placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
            </div>

            {/* Grok API Key */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">Grok API Key</Label>
                <Input
                    type="password"
                    placeholder="Enter xAI Console Key"
                    value={grokKey}
                    onChange={(e) => setGrokKey(e.target.value)}
                    className="bg-[#18181b] border-[#27272a] text-white h-11 rounded-[10px] placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
            </div>

            {/* OpenAI API Key */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">OpenAI API Key</Label>
                <Input
                    type="password"
                    placeholder="Enter OpenAI API Key"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="bg-[#18181b] border-[#27272a] text-white h-11 rounded-[10px] placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
            </div>

            {/* Auto-translate Domains */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 font-medium">Auto-translate Domains</Label>
                <Textarea
                    placeholder="e.g. example.com (one per line)"
                    value={autoSites}
                    onChange={(e) => setAutoSites(e.target.value)}
                    className="bg-[#18181b] border-[#27272a] text-white min-h-[80px] rounded-[10px] placeholder:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                />
            </div>

            {/* Selection Popup Toggle */}
            <div className="flex items-center justify-between py-3 px-3 bg-[#18181b] rounded-[10px] border border-[#27272a]">
                <div className="space-y-0.5">
                    <Label className="text-sm text-white font-medium">Selection Popup</Label>
                    <p className="text-[11px] text-zinc-500">Show translation popup on text selection</p>
                </div>
                <button
                    onClick={() => setSelectionPopupEnabled(!selectionPopupEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${selectionPopupEnabled ? 'bg-violet-600' : 'bg-zinc-700'
                        }`}
                >
                    <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${selectionPopupEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                    />
                </button>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col gap-3">
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full h-11 text-sm font-semibold rounded-[10px] bg-violet-600 hover:bg-violet-500 transition-all"
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
                    onClick={handleClearCache}
                    disabled={isClearing}
                    className="w-full h-11 text-sm font-medium rounded-[10px] bg-transparent border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
                >
                    {isClearing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {isClearing ? "Clearing..." : "Clear Translation Cache"}
                </Button>
            </div>

            <p className="text-[11px] text-zinc-600 text-center pt-1">
                Settings save automatically on change
            </p>
        </div>
    );
}

