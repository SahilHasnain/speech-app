import AdminHeader from "@/components/AdminHeader";
import Link from "next/link";

export default function IngestPage() {
    return (
        <>
            <AdminHeader />
            <div className="min-h-screen bg-neutral-900 text-white">
                <div className="max-w-7xl mx-auto p-8">
                    <h1 className="text-3xl font-bold mb-8">Speech Ingestion</h1>

                    <div className="bg-neutral-800 rounded-lg border border-neutral-700 p-12 text-center">
                        <div className="text-6xl mb-6">📥</div>
                        <h2 className="text-2xl font-semibold mb-4">Coming Soon</h2>
                        <p className="text-neutral-400 mb-8 max-w-md mx-auto">
                            The speech ingestion interface is under development. You can still use the CLI
                            script for now.
                        </p>
                        <div className="bg-neutral-900 rounded-lg p-4 max-w-lg mx-auto">
                            <p className="text-sm text-neutral-400 mb-2">CLI Command:</p>
                            <code className="text-sky-400 font-mono text-sm">
                                npm run ingest:speeches
                            </code>
                        </div>
                        <div className="mt-8">
                            <Link
                                href="/channels"
                                className="inline-flex items-center text-sky-400 hover:text-sky-300 font-medium transition-colors"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                    />
                                </svg>
                                Go to Channel Management
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
