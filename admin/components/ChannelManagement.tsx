"use client";

import { useEffect, useState } from "react";

interface Channel {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type: string;
  thumbnailUrl?: string;
  description?: string;
  ignoreDuration: boolean;
  includeShorts: boolean;
}

interface YouTubePreview {
  type: "channel" | "playlist";
  youtubeChannelId: string;
  name: string;
  thumbnailUrl: string;
  description: string;
  subscriberCount?: number;
  videoCount: number;
}

export default function ChannelManagement() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/channels");
      const data = await response.json();

      if (response.ok && data.channels) {
        setChannels(data.channels);
      } else {
        console.error("Failed to fetch channels:", data);
        setChannels([]);
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm("This will delete all speeches from channels that no longer exist. Continue?")) {
      return;
    }

    try {
      setCleaningUp(true);
      const response = await fetch("/api/channels/cleanup", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        const totalVideos = (data.deletedVideos || 0) + (data.deletedOrphanedStorageVideos || 0);
        alert(
          `Cleanup complete!\n\n` +
          `📝 Deleted ${data.deletedCount} orphaned speeches\n` +
          `🎥 Deleted ${totalVideos} orphaned videos\n` +
          `   • ${data.deletedVideos || 0} from deleted channels\n` +
          `   • ${data.deletedOrphanedStorageVideos || 0} unreferenced in storage\n` +
          `📺 From ${data.orphanedChannels.length} deleted channels\n\n` +
          `Orphaned channels:\n${data.orphanedChannels.join("\n")}`
        );
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
      alert("Failed to cleanup orphaned speeches");
    } finally {
      setCleaningUp(false);
    }
  };

  const handleDelete = (channel: Channel) => {
    setSelectedChannel(channel);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedChannel) return;

    try {
      const response = await fetch("/api/channels/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeChannelId: selectedChannel.youtubeChannelId }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchChannels();
        setShowDeleteModal(false);
        setSelectedChannel(null);
        // Show success message
        const message = `Successfully deleted:\n• Channel: ${selectedChannel.name}\n• Speeches: ${data.deletedSpeeches || 0}\n• Videos: ${data.deletedVideos || 0}`;
        alert(message);
      } else {
        console.error("Delete error:", data);
        alert(`Error: ${data.error || "Failed to delete channel"}`);
      }
    } catch (error) {
      console.error("Error deleting channel:", error);
      alert("Failed to delete channel. Please check the console for details.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
          <p className="text-neutral-400">Loading channels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Channel Management</h1>
        <div className="flex gap-3">
          <button
            onClick={handleCleanup}
            disabled={cleaningUp}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            title="Delete speeches from channels that no longer exist"
          >
            {cleaningUp ? "Cleaning..." : "🧹 Cleanup Orphaned"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-sky-500 hover:bg-sky-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            + Add Channel
          </button>
        </div>
      </div>

      {/* Channels List */}
      <div className="bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
        {channels.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📺</div>
            <p className="text-neutral-400 mb-4">No channels added yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-sky-400 hover:text-sky-300 font-medium"
            >
              Add your first channel
            </button>
          </div>
        ) : (
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
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Settings
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-700">
                {channels.map((channel) => (
                  <tr key={channel.$id} className="hover:bg-neutral-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {channel.thumbnailUrl ? (
                          <img
                            src={channel.thumbnailUrl}
                            alt={channel.name}
                            className="w-12 h-12 rounded-lg object-cover mr-4"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-neutral-700 flex items-center justify-center mr-4 text-2xl">
                            {channel.type === "playlist" ? "📋" : "📺"}
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{channel.name}</div>
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
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {channel.ignoreDuration && (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-300"
                            title="Ignore Duration Limit"
                          >
                            ∞
                          </span>
                        )}
                        {channel.includeShorts && (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300"
                            title="Include Shorts"
                          >
                            📱
                          </span>
                        )}
                        {!channel.ignoreDuration && !channel.includeShorts && (
                          <span className="text-neutral-500 text-xs">Default</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDelete(channel)}
                        className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Channel Modal */}
      {showAddModal && (
        <AddChannelModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchChannels();
            setShowAddModal(false);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedChannel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-800 rounded-lg border border-neutral-700 max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-white mb-4">Delete Channel</h3>
            <p className="text-neutral-300 mb-6">
              Are you sure you want to delete <strong>{selectedChannel.name}</strong>? This will
              delete:
            </p>
            <ul className="text-neutral-400 mb-6 space-y-1 list-disc list-inside">
              <li>The channel entry</li>
              <li>All speeches associated with this channel</li>
              <li>All video files from storage</li>
            </ul>
            <p className="text-red-400 text-sm mb-6">This action cannot be undone!</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedChannel(null);
                }}
                className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add Channel Modal Component
function AddChannelModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sourceType, setSourceType] = useState<"channel" | "playlist">("channel");
  const [sourceId, setSourceId] = useState("");
  const [ignoreDuration, setIgnoreDuration] = useState(false);
  const [includeShorts, setIncludeShorts] = useState(false);
  const [preview, setPreview] = useState<YouTubePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchPreview = async () => {
    if (!sourceId.trim()) {
      setError("Please enter a channel or playlist ID");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/youtube/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: sourceId.trim(), sourceType }),
      });

      const data = await response.json();

      if (response.ok) {
        setPreview(data.info);
      } else {
        setError(data.error || "Failed to fetch preview");
        setPreview(null);
      }
    } catch (error) {
      console.error("Error fetching preview:", error);
      setError("Failed to fetch preview");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!preview) return;

    try {
      setAdding(true);
      setError("");
      const response = await fetch("/api/channels/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: sourceId.trim(),
          sourceType,
          ignoreDuration,
          includeShorts,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
      } else {
        setError(data.error || "Failed to add channel");
      }
    } catch (error) {
      console.error("Error adding channel:", error);
      setError("Failed to add channel");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-neutral-800 rounded-lg border border-neutral-700 max-w-2xl w-full my-8">
        <div className="sticky top-0 bg-neutral-800 border-b border-neutral-700 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h3 className="text-xl font-semibold text-white">Add Channel</h3>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Source Type Selection */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Source Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="channel"
                  checked={sourceType === "channel"}
                  onChange={(e) => {
                    setSourceType(e.target.value as "channel");
                    setPreview(null);
                  }}
                  className="mr-2"
                />
                <span className="text-white">YouTube Channel</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="playlist"
                  checked={sourceType === "playlist"}
                  onChange={(e) => {
                    setSourceType(e.target.value as "playlist");
                    setPreview(null);
                  }}
                  className="mr-2"
                />
                <span className="text-white">YouTube Playlist</span>
              </label>
            </div>
          </div>

          {/* Source ID Input */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              {sourceType === "channel" ? "Channel ID" : "Playlist ID"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  setPreview(null);
                }}
                placeholder={
                  sourceType === "channel"
                    ? "e.g., UCDwHEBKDyZvCbHLjNh8olfQ"
                    : "e.g., PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
                }
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500"
              />
              <button
                onClick={fetchPreview}
                disabled={loading || !sourceId.trim()}
                className="bg-sky-500 hover:bg-sky-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? "Loading..." : "Preview"}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-700">
              <div className="flex items-start gap-4">
                <img
                  src={preview.thumbnailUrl}
                  alt={preview.name}
                  className="w-24 h-24 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-white mb-1">{preview.name}</h4>
                  <p className="text-sm text-neutral-400 mb-2 line-clamp-2">
                    {preview.description}
                  </p>
                  <div className="flex gap-4 text-sm text-neutral-400">
                    {preview.subscriberCount !== undefined && (
                      <span>👥 {preview.subscriberCount.toLocaleString()} subscribers</span>
                    )}
                    <span>📹 {preview.videoCount.toLocaleString()} videos</span>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="mt-4 pt-4 border-t border-neutral-700 space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={ignoreDuration}
                    onChange={(e) => setIgnoreDuration(e.target.checked)}
                    className="mr-3"
                  />
                  <div>
                    <span className="text-white font-medium">Ignore Duration Limit</span>
                    <p className="text-xs text-neutral-400">
                      Allow videos longer than 20 minutes
                    </p>
                  </div>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeShorts}
                    onChange={(e) => setIncludeShorts(e.target.checked)}
                    className="mr-3"
                  />
                  <div>
                    <span className="text-white font-medium">Include Shorts</span>
                    <p className="text-xs text-neutral-400">
                      Include videos shorter than 60 seconds
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-neutral-800 border-t border-neutral-700 px-6 py-4 flex gap-3 justify-end rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!preview || adding}
            className="px-6 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-medium transition-colors"
          >
            {adding ? "Adding..." : "Add Channel"}
          </button>
        </div>
      </div>
    </div>
  );
}
