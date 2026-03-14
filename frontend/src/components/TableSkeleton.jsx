/**
 * Shared loading skeleton for table-heavy pages.
 * Renders animated placeholder rows while data loads.
 */
export default function TableSkeleton({ rows = 8, cols = 5, showHeader = true, showKpis = false, kpiCount = 4 }) {
    return (
        <div className="animate-pulse space-y-6">
            {/* KPI cards skeleton */}
            {showKpis && (
                <div className={`grid grid-cols-2 lg:grid-cols-${kpiCount} gap-4`}>
                    {Array.from({ length: kpiCount }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                            <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 mb-4" />
                            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                    ))}
                </div>
            )}

            {/* Table skeleton */}
            <div className="cf-table-wrap">
                {showHeader && (
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                        <div className="h-9 w-48 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                    </div>
                )}
                <table className="cf-table">
                    <thead>
                        <tr>
                            {Array.from({ length: cols }).map((_, i) => (
                                <th key={i}>
                                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: rows }).map((_, r) => (
                            <tr key={r}>
                                {Array.from({ length: cols }).map((_, c) => (
                                    <td key={c}>
                                        <div className={`h-4 rounded ${c === 0 ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'}`}
                                            style={{ width: `${50 + Math.random() * 40}%` }} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
