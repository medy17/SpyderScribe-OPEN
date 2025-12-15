import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { Loader2, Trash2, Database, HardDrive, RefreshCw } from 'lucide-react';

interface CacheEntry {
    key: string;
    source: string;
    target: string;
    originalText: string;
    translation: string;
    createdAt: number;
}

interface CacheStats {
    memoryCount: number;
    dbCount: number;
    totalCount: number;
}

interface PaginatedCacheResult {
    entries: CacheEntry[];
    hasMore: boolean;
    total: number;
}

export default function CacheTab() {
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [entries, setEntries] = useState<CacheEntry[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    const loadStats = useCallback(() => {
        chrome.runtime.sendMessage({ action: 'getCacheStats' }, (response: CacheStats) => {
            if (chrome.runtime.lastError) {
                console.error('Stats error:', chrome.runtime.lastError);
                return;
            }
            setStats(response);
        });
    }, []);

    const loadEntries = useCallback((pageNum: number, append: boolean = false) => {
        setIsLoading(true);
        chrome.runtime.sendMessage(
            { action: 'getCacheEntries', page: pageNum, limit: 15 },
            (response: PaginatedCacheResult) => {
                setIsLoading(false);
                if (chrome.runtime.lastError) {
                    console.error('Entries error:', chrome.runtime.lastError);
                    return;
                }
                if (append) {
                    setEntries(prev => [...prev, ...response.entries]);
                } else {
                    setEntries(response.entries);
                }
                setHasMore(response.hasMore);
                setPage(pageNum);
            }
        );
    }, []);

    useEffect(() => {
        loadStats();
        loadEntries(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLoadMore = () => {
        loadEntries(page + 1, true);
    };

    const handleRefresh = () => {
        loadStats();
        loadEntries(0, false);
    };

    const handleClearCache = () => {
        setIsClearing(true);
        chrome.runtime.sendMessage({ action: 'clearCache' }, (response) => {
            setIsClearing(false);
            if (chrome.runtime.lastError || !response) {
                toast.error("Failed to clear cache");
                return;
            }
            toast.success("Cache cleared");
            setEntries([]);
            setStats({ memoryCount: 0, dbCount: 0, totalCount: 0 });
            setPage(0);
            setHasMore(false);
        });
    };

    const formatAge = useCallback((timestamp: number): string => {
        const now = performance.timeOrigin + performance.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }, []);

    const truncate = (text: string, maxLen: number = 50): string => {
        if (text.length <= maxLen) return text;
        return text.slice(0, maxLen) + '...';
    };

    return (
        <div className="space-y-4">
            {/* Stats Header */}
            <div className="flex items-center justify-between p-3 bg-[#18181b] rounded-xl border border-[#27272a]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs">
                        <Database className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-zinc-400">Memory:</span>
                        <span className="text-white font-medium">{stats?.memoryCount ?? '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <HardDrive className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-zinc-400">Disk:</span>
                        <span className="text-white font-medium">{stats?.dbCount ?? '-'}</span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Entries List */}
            <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {entries.length === 0 && !isLoading ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        No cached translations
                    </div>
                ) : (
                    entries.map((entry, index) => (
                        <div
                            key={`${entry.key}-${index}`}
                            className="p-3 bg-[#18181b] rounded-lg border border-[#27272a] space-y-1.5"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                                    {entry.source} → {entry.target}
                                </span>
                                <span className="text-[10px] text-zinc-600">
                                    {formatAge(entry.createdAt)}
                                </span>
                            </div>
                            <div className="text-xs text-zinc-400 truncate" title={entry.originalText}>
                                {truncate(entry.originalText, 60)}
                            </div>
                            <div className="text-xs text-emerald-400/80 truncate" title={entry.translation}>
                                → {truncate(entry.translation, 60)}
                            </div>
                        </div>
                    ))
                )}

                {/* Load More Button */}
                {hasMore && (
                    <Button
                        variant="ghost"
                        onClick={handleLoadMore}
                        disabled={isLoading}
                        className="w-full h-9 text-xs text-zinc-400 hover:text-white border border-dashed border-zinc-700 hover:border-zinc-500"
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : null}
                        {isLoading ? 'Loading...' : 'Load More'}
                    </Button>
                )}
            </div>

            {/* Clear Cache Button */}
            <Button
                variant="outline"
                onClick={handleClearCache}
                disabled={isClearing || (stats?.totalCount ?? 0) === 0}
                className="w-full h-10 text-sm font-medium rounded-[10px] bg-transparent border border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
            >
                {isClearing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                )}
                {isClearing ? "Clearing..." : "Clear All Cache"}
            </Button>
        </div>
    );
}
