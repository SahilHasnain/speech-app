import AdminHeader from "@/components/AdminHeader";
import Link from "next/link";

export default function AdminPage() {
  return (
    <>
      <AdminHeader />
      <div className="min-h-screen bg-neutral-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              href="/database"
              className="bg-neutral-800 hover:bg-neutral-700 rounded-lg p-6 transition-colors border border-neutral-700"
            >
              <div className="text-4xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold mb-2">Database Inspector</h2>
              <p className="text-neutral-400">
                View database statistics, channel information, and storage details
              </p>
            </Link>

            <Link
              href="/channels"
              className="bg-neutral-800 hover:bg-neutral-700 rounded-lg p-6 transition-colors border border-neutral-700"
            >
              <div className="text-4xl mb-4">📺</div>
              <h2 className="text-xl font-semibold mb-2">Channel Management</h2>
              <p className="text-neutral-400">
                Add, edit, and delete YouTube channels and playlists
              </p>
            </Link>

            <Link
              href="/ingest"
              className="bg-neutral-800 hover:bg-neutral-700 rounded-lg p-6 transition-colors border border-neutral-700"
            >
              <div className="text-4xl mb-4">📥</div>
              <h2 className="text-xl font-semibold mb-2">Speech Ingestion</h2>
              <p className="text-neutral-400">
                Ingest speeches from channels with real-time progress tracking
              </p>
            </Link>

            <Link
              href="/videos"
              className="bg-neutral-800 hover:bg-neutral-700 rounded-lg p-6 transition-colors border border-neutral-700"
            >
              <div className="text-4xl mb-4">🎥</div>
              <h2 className="text-xl font-semibold mb-2">Video Management</h2>
              <p className="text-neutral-400">
                Download and manage video files for speeches
              </p>
            </Link>

            <div className="bg-neutral-800/50 rounded-lg p-6 border border-neutral-700/50 opacity-50">
              <div className="text-4xl mb-4">⚙️</div>
              <h2 className="text-xl font-semibold mb-2">Settings</h2>
              <p className="text-neutral-400">
                Coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
