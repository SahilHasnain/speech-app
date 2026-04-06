"use client";

import { useEffect, useState } from "react";

interface DatabaseStats {
    totalDocuments: number;
    totalSpeeches: number;
    totalShorts: number;
    channelsCount: number;
    videoFilesCount: number;
}

interface ChannelStats {
    $id: string;
    name: string;
    youtubeChannelId: string;
    type: string;
    ignoreDuration: boolean;
    includeShorts: boolean;
    totalCount: number;
    speechesOnlyCount: number;
    shortsCount: number;
    videoCount: number;
}

interface ChannelDetails extends ChannelStats {
    total: number;
    speechesOnly: number;
    shorts: number;
    speechVideoCount: number;
    shortVideoCount: number;
    under20Min: number;
    over20Min: number;
    totalDuration: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
    documentsWithoutVideo: number;
}

export default function DatabaseInspector() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DatabaseStats | null>(null);
    const [channels, setChannels] = useState<ChannelStats[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
    const [channelDetails, setChannelDetails] = useState<ChannelDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        fetchDatabaseStats();
    }, []);

    const fetchDatabaseStats = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/database/stats");
            const data = await response.json();
            setStats(data.stats);
            setChannels(data.channels);
        } catch (error) {
            console.error("Error fetching database stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchChannelDetails = async (channelId: string) => {
        try {
            setLoadingDetails(true);
            setSelectedChannel(channelId);
            const response = await fetch(`/api/database/channel/${channelId}`);
            const data = await response.json();
            setChannelDetails(data);
        } catch (error) {
            console.error("Error fetching channel details:", error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
                    <p className="text-neutral-400">Loading database statistics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-8">Database Inspector</h1>

            {/* Database Overview */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-sky-300">Database Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                        <div className="text-3xl mb-2">📊</div>
                        <div className="text-2xl font-bold text-white">
                            {stats?.totalDocuments.toLocaleString()}
                        </div>
                        <div className="text-sm text-neutral-400">Total Documents</div>
                    </div>

                    <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                        <div className="text-3xl mb-2">📹</div>
                        <div className="text-2xl font-bold text-sky-400">
                            {stats?.totalSpeeches.toLocaleString()}
                        </div>
                        <div className="text-sm text-neutral-400">Speeches</div>
                    </div>

                    <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                        <div className="text-3xl mb-2">🎬</div>
                        <div className="text-2xl font-bold text-purple-400">
                            {stats?.totalShorts.toLocaleString()}
                        </div>
                        <div className="text-sm text-neutral-400">Shorts</div>
                    </div>

                    <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                        <div className="text-3xl mb-2">📺</div>
                        <div className="text-2xl font-bold text-white">
                            {stats?.channelsCount.toLocaleString()}
                        </div>
                        <div className="text-sm text-neutral-400">Channels</div>
                    </div>

                    <div className="bg-neutral-800 rounded-lg p-6 border border-neutral-700">
                        <div className="text-3xl mb-2">🎥</div>
                        <div className="text-2xl font-bold text-white">
                            {stats?.videoFilesCount.toLocaleString()}
                        </div>
                        <div className="text-sm text-neutral-400">Video Files</div>
                    </div>
                </div>
            </div>

            {/* Channels List */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 text-sky-300">Channels</h2>
                <div className="bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-neutral-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                        Channel
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                        Total
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                        Speeches
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                        Shorts
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                        Videos
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                        Coverage
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-neutral-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-700">
                                {channels.map((channel) => {
                                    const coverage =
                                        channel.totalCount > 0
                                            ? ((channel.videoCount / channel.totalCount) * 100).toFixed(1)
                                            : "0.0";

                                    return (
                                        <tr
                                            key={channel.$id}
                                            className="hover:bg-neutral-700/30 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <span className="text-2xl mr-3">
                                                        {channel.type === "playlist" ? "📋" : "📺"}
                                                    </span>
                                                    <div>
                                                        <div className="text-sm font-medium text-white">
                                                            {channel.name}
                                                        </div>
                                                        <div className="text-xs text-neutral-400 font-mono">
                                                            {channel.youtubeChannelId}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-700 text-neutral-300">
                                                    {channel.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-white font-semibold">
                                                {channel.totalCount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-sky-400">
                                                {channel.speechesOnlyCount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-purple-400">
                                                {channel.shortsCount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-white">
                                                {channel.videoCount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end">
                                                    <div className="w-16 bg-neutral-700 rounded-full h-2 mr-2">
                                                        <div
                                                            className="bg-sky-500 h-2 rounded-full"
                                                            style={{ width: `${Math.min(parseFloat(coverage), 100)}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-sm text-white">{coverage}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => fetchChannelDetails(channel.youtubeChannelId)}
                                                    className="text-sky-400 hover:text-sky-300 text-sm font-medium transition-colors"
                                                >
                                                    Inspect
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Channel Details Modal */}
            {selectedChannel && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-neutral-800 rounded-lg border border-neutral-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-neutral-800 border-b border-neutral-700 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-white">
                                {channelDetails?.name || "Loading..."}
                            </h3>
                            <button
                                onClick={() => {
                                    setSelectedChannel(null);
                                    setChannelDetails(null);
                                }}
                                className="text-neutral-400 hover:text-white transition-colors"
                            >
                                <svg
                                    className="w-6 h-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            {loadingDetails ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
                                    <p className="text-neutral-400">Loading channel details...</p>
                                </div>
                            ) : channelDetails ? (
                                <div className="space-y-6">
                                    {/* Document Stats */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-neutral-300 mb-3">
                                            Document Breakdown
                                        </h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-neutral-900 rounded-lg p-4">
                                                <div className="text-2xl font-bold text-white">
                                                    {channelDetails.total.toLocaleString()}
                                                </div>
                                                <div className="text-sm text-neutral-400">Total Documents</div>
                                            </div>

                                            <div className="bg-neutral-900 rounded-lg p-4">
                                                <div className="text-2xl font-bold text-sky-400">
                                                    {channelDetails.speechesOnly.toLocaleString()}
                                                </div>
                                                <div className="text-sm text-neutral-400">Speeches</div>
                                            </div>

                                            <div className="bg-neutral-900 rounded-lg p-4">
                                                <div className="text-2xl font-bold text-purple-400">
                                                    {channelDetails.shorts.toLocaleString()}
                                                </div>
                                                <div className="text-sm text-neutral-400">Shorts</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Video Stats */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-neutral-300 mb-3">
                                            Video Files in Storage
                                        </h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-neutral-900 rounded-lg p-4">
                                                <div className="text-2xl font-bold text-green-500">
                                                    {channelDetails.videoCount.toLocaleString()}
                                                </div>
                                                <div className="text-sm text-neutral-400">Total Videos</div>
                                            </div>

                                            <div className="bg-neutral-900 rounded-lg p-4">
                                                <div className="text-2xl font-bold text-sky-400">
                                                    {channelDetails.speechVideoCount.toLocaleString()}
                                                </div>
                                                <div className="text-sm text-neutral-400">Speech Videos</div>
                                            </div>

                                            <div className="bg-neutral-900 rounded-lg p-4">
                                                <div className="text-2xl font-bold text-purple-400">
                                                    {channelDetails.shortVideoCount.toLocaleString()}
                                                </div>
                                                <div className="text-sm text-neutral-400">Short Videos</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Additional Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-neutral-900 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-amber-500">
                                                {channelDetails.documentsWithoutVideo.toLocaleString()}
                                            </div>
                                            <div className="text-sm text-neutral-400">Documents Without Video</div>
                                        </div>

                                        <div className="bg-neutral-900 rounded-lg p-4">
                                            <div className="text-2xl font-bold text-white">
                                                {formatDuration(Math.round(channelDetails.avgDuration))}
                                            </div>
                                            <div className="text-sm text-neutral-400">Avg Duration</div>
                                        </div>
                                    </div>

                                    {/* Duration Breakdown */}
                                    <div className="bg-neutral-900 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-neutral-300 mb-3">
                                            Duration Breakdown
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-xl font-bold text-sky-400">
                                                    {channelDetails.under20Min.toLocaleString()}
                                                </div>
                                                <div className="text-sm text-neutral-400">&lt; 20 minutes</div>
                                            </div>
                                            <div>
                                                <div className="text-xl font-bold text-blue-600">
                                                    {channelDetails.over20Min.toLocaleString()}
                                                </div>
                                                <div className="text-sm text-neutral-400">≥ 20 minutes</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duration Info */}
                                    <div className="bg-neutral-900 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-neutral-300 mb-3">
                                            Duration Statistics
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-neutral-400">Total Duration:</span>
                                                <span className="text-white font-mono">
                                                    {formatDuration(channelDetails.totalDuration)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-400">Longest Speech:</span>
                                                <span className="text-white font-mono">
                                                    {formatDuration(channelDetails.maxDuration)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-400">Shortest Speech:</span>
                                                <span className="text-white font-mono">
                                                    {formatDuration(channelDetails.minDuration)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Settings */}
                                    <div className="bg-neutral-900 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-neutral-300 mb-3">
                                            Channel Settings
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-neutral-400">Ignore Duration:</span>
                                                <span
                                                    className={
                                                        channelDetails.ignoreDuration
                                                            ? "text-green-500"
                                                            : "text-neutral-500"
                                                    }
                                                >
                                                    {channelDetails.ignoreDuration ? "Yes" : "No"}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-neutral-400">Include Shorts:</span>
                                                <span
                                                    className={
                                                        channelDetails.includeShorts
                                                            ? "text-green-500"
                                                            : "text-neutral-500"
                                                    }
                                                >
                                                    {channelDetails.includeShorts ? "Yes" : "No"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
