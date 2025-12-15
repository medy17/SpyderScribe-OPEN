import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TranslateTab from './components/TranslateTab';
import SettingsTab from './components/SettingsTab';
import CacheTab from './components/CacheTab';
import { Toaster } from 'sonner';

export default function Popup() {
    const [activeTab, setActiveTab] = useState("translate");

    return (
        <div className="w-[360px] min-h-[480px] bg-[#09090b] text-white p-5 font-sans antialiased">
            {/* Header */}
            <header className="flex items-center justify-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30 font-display">
                    S
                </div>
                <h3 className="m-0 text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent tracking-tight font-display">
                    Spider Scribe
                </h3>
            </header>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#18181b] p-1 rounded-xl border border-[#27272a] mb-6 h-auto">
                    <TabsTrigger
                        value="translate"
                        className="py-2 text-sm font-medium text-zinc-400 rounded-lg transition-all duration-300 data-[state=active]:bg-[#27272a] data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-md font-sans"
                    >
                        Translate
                    </TabsTrigger>
                    <TabsTrigger
                        value="settings"
                        className="py-2 text-sm font-medium text-zinc-400 rounded-lg transition-all duration-300 data-[state=active]:bg-[#27272a] data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-md font-sans"
                    >
                        Settings
                    </TabsTrigger>
                    <TabsTrigger
                        value="cache"
                        className="py-2 text-sm font-medium text-zinc-400 rounded-lg transition-all duration-300 data-[state=active]:bg-[#27272a] data-[state=active]:text-white data-[state=active]:font-semibold data-[state=active]:shadow-md font-sans"
                    >
                        Cache
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="translate" className="mt-0 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                    <TranslateTab />
                </TabsContent>
                <TabsContent value="settings" className="mt-0 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                    <SettingsTab />
                </TabsContent>
                <TabsContent value="cache" className="mt-0 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                    <CacheTab />
                </TabsContent>
            </Tabs>
            <Toaster
                position="bottom-center"
                toastOptions={{
                    style: {
                        background: '#18181b',
                        border: '1px solid #27272a',
                        color: '#fff',
                        fontFamily: 'var(--font-sans)',
                    },
                }}
            />
        </div>
    );
}

