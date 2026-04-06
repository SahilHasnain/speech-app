"use client";

import { useEffect, useState } from "react";

interface Channel {
    $id: string;
    name: string;
    youtubeChannelId: string;
    type: string;
}

interface UploadStats {
    totalWithoutVideo: number;
    shortsWithoutVideo: number;
    speechesWithoutVideo: number;
}

interface UploadProgress {
    type: "progress" | "success" | "error" | "complete";
    current: number;
    total: number;
    speechId?: string;
    title?: string;
    message?: string;
    status?: "downloading" | "transcoding" | "uploading" | "updating";
}

interface UploadResult {
    successful: number;
    failed: number;
    errors: string[];
}

export default function VideoUpload() {
    const [loading, setLoading] = useState(true);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [stats, setStats] = useState<UploadStats | null>(null);
    const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
    const [uploadMode, setUploadMode] = useState<"all" | "shorts" | "speeches">("all");
    const [quality, setQuality] = useState<480 | 720 | 1080>(720);
    const [limit, setLimit] = useState<number>(10);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/videos/upload-stats");
            const data = await response.json();
            setChannels(data.channels);
            setStats(data.stats);
        } catch (error) {
            console.error("Error fetching data:", error);
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

    const handleStartUpload = async () => {
        if (selectedChannels.length === 0) {
            alert("Please select at least one channel");
            return;
        }

        setIsUploading(true);
        setProgress(null);
        setResult(null);
        setLogs([]);
        addLog("Starting upload process...");

        try {
            const response = await fetch("/api/videos/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channels: selectedChannels,
                    uploadMode,
                    quality,
                    limit,
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

                            if (data.type === "complete" && data.result) {
                                setResult(data.result);
                                addLog(
                                    `Upload complete: ${data.result.successful} successful, ${data.result.failed} failed`
                                );
                            } else if (data.type === "progress") {
                                setProgress(data);
                                addLog(`[${data.current}/${data.total}] ${data.title} - ${data.status}`);
                            } else if (data.type === "success") {
                                addLog(`✓ ${data.title} - Success`);
                            } else if (data.type === "error") {
                                addLog(`✗ ${data.title} - Error: ${data.message}`);
                            }
                        } catch (e) {
                            console.error("Failed to parse SSE data:", e);
                        }
                    }
                }
            }

            // Refresh stats after upload
            await fetchData();
        } catch (error) {
            console.error("Upload error:", error);
            addLog(`Error: ${error instanceof Error ? error.message : "Upload failed"}`);
        } finally {
            setIsUploading(false);
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

    const estimatedCount =
        uploadMode === "all"
            ? stats?.totalWithoutVideo || 0
            : uploadMode === "shorts"
                ? stats?.shortsWithoutVideo || 0
                : stats?.speechesWithoutVideo || 0;

    return (
        <div className="max-w-7xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-2">Video Upload</h1>
            <p className="text-neutral-400 mb-8">
                Download videos from YouTube and upload them to Appwrite Storage
            </p>

            {/* Stats Overview */}
            {stats && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-sky-300">
                        Speeches Without Videos
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                            <div className="text-3xl mb-2">📊</div>
                            <div className="text-2xl font-bold text-white">
                                {stats.totalWithoutVideo.toLocaleString()}
                            </div>
                            <div className="text-sm text-neutral-400">Total</div>
                        </div>

                        <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                            <div className="text-3xl mb-2">📹</div>
                            <div className="text-2xl font-bold text-sky-400">
                                {stats.speechesWithoutVideo.toLocaleString()}
                            </div>
                            <div className="text-sm text-neutral-400">Speeches (≥60s)</div>
                        </div>

                        <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                            <div className="text-3xl mb-2">🎬</div>
                            <div className="text-2xl font-bold text-purple-400">
                                {stats.shortsWithoutVideo.toLocaleString()}
                            </div>
                            <div className="text-sm text-neutral-400">Shorts (&lt;60s)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Configuration */}
            <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6 mb-8">
                <h2 className="text-xl font-semibold mb-6">Upload Configuration</h2>

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

                {/* Upload Mode */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-neutral-300 mb-3">
                        Upload Mode
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setUploadMode("all")}
                            className={`p-3 rounded-lg border transition-colors ${uploadMode === "all"
                                ? "bg-sky-900/30 border-sky-500 text-sky-400"
                                : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                }`}
                        >
                            <div className="text-lg mb-1">📊</div>
                            <div className="text-sm font-medium">All</div>
                        </button>
                        <button
                            onClick={() => setUploadMode("speeches")}
                            className={`p-3 rounded-lg border transition-colors ${uploadMode === "speeches"
                                ? "bg-sky-900/30 border-sky-500 text-sky-400"
                                : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                }`}
                        >
                            <div className="text-lg mb-1">📹</div>
                            <div className="text-sm font-medium">Speeches</div>
                        </button>
                        <button
                            onClick={() => setUploadMode("shorts")}
                            className={`p-3 rounded-lg border transition-colors ${uploadMode === "shorts"
                                ? "bg-purple-900/30 border-purple-500 text-purple-400"
                                : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:border-neutral-600"
                                }`}
                        >
                            <div className="text-lg mb-1">🎬</div>
                            <div className="text-sm font-medium">Shorts</div>
                        </button>
                    </div>
                </div>

                {/* Quality and Limit */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-3">
                            Video Quality
                        </label>
                        <select
                            value={quality}
                            onChange={(e) => setQuality(parseInt(e.target.value) as any)}
                            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                        >
                            <option value={480}>480p</option>
                            <option value={720}>720p (Recommended)</option>
                            <option value={1080}>1080p</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-3">
                            Limit (videos to process)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={limit}
                            onChange={(e) => setLimit(parseInt(e.target.value) || 1)}
                            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                        />
                    </div>
                </div>

                {/* Estimated Count */}
                <div className="bg-neutral-900 rounded-lg p-4 mb-6">
                    <div className="text-sm text-neutral-400">
                        Estimated videos to process:{" "}
                        <span className="text-white font-semibold">
                            {Math.min(limit, estimatedCount)} of {estimatedCount}
                        </span>
                    </div>
                </div>

                {/* Start Button */}
                <button
                    onClick={handleStartUpload}
                    disabled={isUploading || selectedChannels.length === 0}
                    className="w-full px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                    {isUploading ? "Uploading..." : "Start Upload"}
                </button>
            </div>

            {/* Progress */}
            {(progress || isUploading) && (
                <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">Upload Progress</h2>

                    {progress && (
                        <>
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-neutral-400">
                                        {progress.current} of {progress.total}
                                    </span>
                                    <span className="text-neutral-400">
                                        {Math.round((progress.current / progress.total) * 100)}%
                                    </span>
                                </div>
                                <div className="w-full bg-neutral-700 rounded-full h-2">
                                    <div
                                        className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                                        style={{
                                            width: `${(progress.current / progress.total) * 100}%`,
                                        }}
                                    ></div>
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="text-sm">
                                    <span className="text-neutral-400">Current: </span>
                                    <span className="text-white">{progress.title}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-neutral-400">Status: </span>
                                    <span
                                        className={
                                            progress.type === "success"
                                                ? "text-green-400"
                                                : progress.type === "error"
                                                    ? "text-red-400"
                                                    : "text-sky-400"
                                        }
                                    >
                                        {progress.status || progress.type}
                                    </span>
                                </div>
                                {progress.message && (
                                    <div className="text-sm text-neutral-400">{progress.message}</div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Logs */}
                    <div className="bg-neutral-900 rounded-lg p-4 max-h-64 overflow-y-auto">
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
            {result && (
                <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-6">
                    <h2 className="text-xl font-semibold mb-4">Upload Results</h2>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                            <div className="text-2xl font-bold text-green-400">
                                {result.successful}
                            </div>
                            <div className="text-sm text-neutral-400">Successful</div>
                        </div>

                        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
                            <div className="text-2xl font-bold text-red-400">{result.failed}</div>
                            <div className="text-sm text-neutral-400">Failed</div>
                        </div>
                    </div>

                    {result.errors.length > 0 && (
                        <div className="bg-neutral-900 rounded-lg p-4">
                            <div className="text-sm font-semibold text-red-400 mb-2">Errors:</div>
                            <div className="text-xs font-mono space-y-1">
                                {result.errors.map((error, index) => (
                                    <div key={index} className="text-neutral-400">
                                        {error}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
