import { HardDrive, Search, LogOut } from 'lucide-react'
import { StorageStats } from '../types'
import { formatBytes } from '../lib/utils'

interface Props {
  searchQuery: string
  onSearchChange: (q: string) => void
  stats: StorageStats | null
  onLogout: () => void
  onSortBySize?: () => void
}

const FREE_QUOTA = 10 * 1024 * 1024 * 1024 // 10 GB R2 免费额度

export default function Topbar({ searchQuery, onSearchChange, stats, onLogout, onSortBySize }: Props) {
  const usedPercent = stats ? Math.min((stats.totalSize / FREE_QUOTA) * 100, 100) : 0

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-4 shrink-0 z-10">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <HardDrive className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-slate-800 text-lg">R2 Drive</span>
      </div>

      {/* 搜索框 */}
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="搜索文件..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-100 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
        />
      </div>

      <div className="flex-1" />

      {/* 存储用量 */}
      {stats && (
        <button
          onClick={onSortBySize}
          title="点击按文件大小排序"
          className="hidden sm:flex flex-col items-end gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
        >
          <span className="text-xs text-slate-500">
            {formatBytes(stats.totalSize)} / 10 GB · {stats.fileCount} 个文件
          </span>
          <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">
            Class A 100万/月 · Class B 1000万/月
          </span>
        </button>
      )}

      {/* 退出 */}
      <button
        onClick={onLogout}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition px-2 py-1.5 rounded-lg hover:bg-red-50"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">退出</span>
      </button>
    </header>
  )
}
