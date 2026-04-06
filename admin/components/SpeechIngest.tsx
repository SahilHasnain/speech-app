"use client";

import { useEffect, useState } from "react";

interface Channel {
    $id: string;
    name: string;
    youtubeChannelId: string;
    type: string;
}

interface IngestResult {
    channelId: string;
    channelName: string;
    newCount: number;
    updatedCount: number;
    unchangedCount: number;
    errorCount: number;
    filteredDurationCount: number;
    totalVideos: number;
    error?: string;
}

export default function SpeechIngest() {
    const [loading, setLoading] = useState(true);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [ingestMode, setIngestMode] = useState<"all" | "shorts" | "speeches">("all");
    const [limit, setLimit] = useState<number | null>(null);
    const [limitEnabled, setLimitEnabled] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);
    const [currentChannel, setCurrentChannel] = useState<string>("");
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<IngestResult[]>([]);

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/channels");
            const data = await response.json();
            setChannels(data.channels || []);
        } catch (error) {
            console.error("Error fetching channels:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChannelToggle = (channelId: string) => {
        setSelectedChannels((prev) =>
            prev.includes(channelId)
                ? prev.filter((id) => id !== channelId)
                : [...prev, channelId]
        );
    };

    const handleSelectAll = () => {
        if (selectedChannels.length === channels.length) {
            setSelectedChannels([]);
        } else {
            setSelectedChannels(channels.map((c) => c.youtubeChannelId));
        }
    };

    const addLog = (message: string) => {
        setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const handleStartIngest = async () => {
        if (selectedChannels.length === 0) {
            alert("Please select at least one channel");
            return;
        }

        setIsIngesting(true);
        setLogs([]);
        setResults([]);
        setCurrentChannel("");
        addLog("Starting ingestion process...");

        try {
            const response = await fetch("/api/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channels: selectedChannels,
                    ingestMode,
                    limit: limitEnabled ? limit : null,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error("No response body");
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === "channel_start") {
                                setCurrentChannel(data.channelName);
                                addLog(`📺 Processing: ${data.channelName}`);
                            } else if (data.type === "progress") {
                                if (data.message) {
                                    addLog(`   ${data.message}`);
                                }
                            } else if (data.type === "success") {
                                addLog(`   ✓ ${data.videoTitle} - ${data.message}`);
                            } else if (data.type === "error") {
                                addLog(`   ✗ ${data.videoTitle || "Error"} - ${data.message}`);
                            } else if (data.type === "channel_complete") {
                                const r = data.result;
                                addLog(
                                    `   ✅ Complete: ${r.newCount} new, ${r.updatedCount} updated, ${r.filteredDurationCount} filtered`
                                );
                            } else if (data.type === "complete" && data.results) {
                                setResults(data.results);
                                addLog("✨ Ingestion complete!");
                            }
                        } catch (e) {
                            console.error("Failed to parse SSE data:", e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Ingest error:", error);
            addLog(`❌ Error: ${error instanceof Error ? error.message : "Ingestion failed"}`);
        } finally {
            setIsIngesting(false);
            setCurrentChannel("");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
                    <p className="text-neutral-400">Loading...</p>
                </div>
            </div>
        );
    }

    const totalNew = results.reduce((sum, r) => sum + r.newCount, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updatedCount, 0);
    const totalFiltered = results.reduce((sum, r) => sum + r.filteredDurationCount, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);

    return (
        <div className="max-w-7xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-2">Speech Ingestion</h1>
            <p className="text-neutral-400 mb-8">
                Fetch speeches from YouTube channels and store them in the database
            </p>

            {/* Configuration */}
            <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6 mb-8">
                <h2 className="text-xl font-semibold mb-6">Ingestion Configuration</h2>

                {/* Channel Selection */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-neutral-300">
                            Select Channels
                        </label>
                        <button
                            onClick={handleSelectAll}
                            className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
                        >
                            {selectedChannels.length === channels.length
                                ? "Deselect All"
                                : "Select All"}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {channels.map((channel) => (
                            <label
                                key={channel.$id}
                                className="flex items-center p-3 bg-neutral-900 rounded-lg border border-neutral-700 hover:border-neutral-600 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedChannels.includes(channel.youtubeChannelId)}
                                    onChange={() => handleChannelToggle(channel.youtubeChannelId)}
                                    className="mr-3 w-4 h-4 text-sky-500 bg-neutral-800 border-neutral-600 rounded focus:ring-sky-500"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-white">
                                        {channel.name}
                                    </div>
                                    <div className="text-xs text-neutral-400">
                                        {channel.type} • {channel.youtubeChannelId}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Ingest Mode */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-neutral-300 mb-3">
                        Ingest Mode
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setIngestMode("all")}
                            className={`p-3 rounded-lg border transition-colors ${ingestMode === "all"
                                    ? "bg-sky-900/30 border-sky-500 text-sky-400"
                                    : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                }`}
                        >
                            <div className="text-lg mb-1">📊</div>
                            <div className="text-sm font-medium">All</div>
                        </button>
                        <button
                            onClick={() => setIngestMode("speeches")}
                            className={`p-3 rounded-lg border transition-colors ${ingestMode === "speeches"
                                    ? "bg-sky-900/30 border-sky-500 text-sky-400"
                                    : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                }`}
                        >
                            <div className="text-lg mb-1">📹</div>
                            <div className="text-sm font-medium">Speeches</div>
                        </button>
                        <button
                            onClick={() => setIngestMode("shorts")}
                            className={`p-3 rounded-lg border transition-colors ${ingestMode === "shorts"
                                    ? "bg-purple-900/30 border-purple-500 text-purple-400"
                                    : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                }`}
                        >
                            <div className="text-lg mb-1">🎬</div>
                            <div className="text-sm font-medium">Shorts</div>
                        </button>
                    </div>
                </div>

                {/* Limit */}
                <div className="mb-6">
                    <label className="flex items-center mb-3">
                        <input
                            type="checkbox"
                            checked={limitEnabled}
                            onChange={(e) => setLimitEnabled(e.target.checked)}
                            className="mr-2 w-4 h-4 text-sky-500 bg-neutral-800 border-neutral-600 rounded focus:ring-sky-500"
                        />
                        <span className="text-sm font-medium text-neutral-300">
                            Limit videos per channel
                        </span>
                    </label>
                    {limitEnabled && (
                        <input
                            type="number"
                            min="1"
                            value={limit || 100}
                            onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                            placeholder="e.g., 100"
                        />
                    )}
                </div>

                {/* Start Button */}
                <button
                    onClick={handleStartIngest}
                    disabled={isIngesting || selectedChannels.length === 0}
                    className="w-full px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                    {isIngesting ? "Ingesting..." : "Start Ingestion"}
                </button>
            </div>

            {/* Progress */}
            {(isIngesting || logs.length > 0) && (
                <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Progress</h2>

                    {currentChannel && (
                        <div className="mb-4 text-sm">
                            <span className="text-neutral-400">Current: </span>
                            <span className="text-white">{currentChannel}</span>
                        </div>
                    )}

                    <div className="bg-neutral-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <div className="text-xs font-mono space-y-1">
                            {logs.map((log, index) => (
                                <div key={index} className="text-neutral-400">
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6">
                    <h2 className="text-xl font-semibold mb-4">Results Summary</h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                            <div className="text-2xl font-bold text-green-400">{totalNew}</div>
                            <div className="text-sm text-neutral-400">New Speeches</div>
                        </div>

                        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                            <div className="text-2xl font-bold text-blue-400">{totalUpdated}</div>
                            <div className="text-sm text-neutral-400">Updated</div>
                        </div>

                        <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4">
                            <div className="text-2xl font-bold text-amber-400">{totalFiltered}</div>
                            <div className="text-sm text-neutral-400">Filtered</div>
                        </div>

                        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                            <div className="text-2xl font-bold text-red-400">{totalErrors}</div>
                            <div className="text-sm text-neutral-400">Errors</div>
                        </div>
                    </div>

                    {/* Per-channel results */}
                    <div className="space-y-3">
                        {results.map((result) => (
                            <div
                                key={result.channelId}
                                className="bg-neutral-900 rounded-lg p-4"
                            >
                                <div className="font-semibold text-white mb-2">
                                    {result.channelName}
                                </div>
                                {result.error ? (
                                    <div className="text-sm text-red-400">Error: {result.error}</div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                                        <div>
                                            <span className="text-neutral-400">Total: </span>
                                            <span className="text-white">{result.totalVideos}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400">New: </span>
                                            <span className="text-green-400">{result.newCount}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400">Updated: </span>
                                            <span className="text-blue-400">{result.updatedCount}</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400">Filtered: </span>
                                            <span className="text-amber-400">
                                                {result.filteredDurationCount}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-400">Errors: </span>
                                            <span className="text-red-400">{result.errorCount}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
