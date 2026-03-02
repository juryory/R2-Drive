import {
  Upload,
  FolderPlus,
  Trash2,
  LayoutGrid,
  List,
  RefreshCw,
  ChevronDown,
  CheckSquare,
  Zap,
  Link2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { ViewMode, SortKey, SortOrder } from '../pages/Dashboard'
import { useState, useRef, useEffect } from 'react'

interface Props {
  selectedCount: number
  totalCount: number
  viewMode: ViewMode
  sortKey: SortKey
  sortOrder: SortOrder
  onViewModeChange: (mode: ViewMode) => void
  onSortChange: (key: SortKey, order: SortOrder) => void
  onUploadClick: () => void
  onNewFolder: () => void
  onDeleteSelected: () => void
  onSelectAll: () => void
  onRefresh: () => void
  onQuickUpload: () => void
  onCreateUploadLink: () => void
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: '名称' },
  { key: 'size', label: '大小' },
  { key: 'date', label: '修改时间' },
]

export default function Toolbar({
  selectedCount,
  totalCount,
  viewMode,
  sortKey,
  sortOrder,
  onViewModeChange,
  onSortChange,
  onUploadClick,
  onNewFolder,
  onDeleteSelected,
  onSelectAll,
  onRefresh,
  onQuickUpload,
  onCreateUploadLink,
}: Props) {
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? '名称'

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200 shrink-0">
      {/* 上传、新建文件夹 */}
      <button
        onClick={onUploadClick}
        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition shadow-sm"
      >
        <Upload className="w-4 h-4" />
        上传
      </button>

      <button
        onClick={onQuickUpload}
        title="简易上传：文件自动命名存至 drive/ 目录"
        className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition shadow-sm"
      >
        <Zap className="w-4 h-4" />
        <span className="hidden sm:inline">简易上传</span>
      </button>

      <button
        onClick={onNewFolder}
        className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition"
      >
        <FolderPlus className="w-4 h-4" />
        <span className="hidden sm:inline">新建文件夹</span>
      </button>

      {/* 删除选中 */}
      {selectedCount > 0 && (
        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-3 py-1.5 rounded-lg border border-red-200 transition animate-fade-in"
        >
          <Trash2 className="w-4 h-4" />
          删除 ({selectedCount})
        </button>
      )}

      {/* 全选 */}
      {totalCount > 0 && (
        <button
          onClick={onSelectAll}
          className={cn(
            'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition',
            selectedCount === totalCount
              ? 'bg-blue-50 text-blue-600 border-blue-200'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          )}
        >
          <CheckSquare className="w-4 h-4" />
          <span className="hidden sm:inline">
            {selectedCount === totalCount ? '取消全选' : '全选'}
          </span>
        </button>
      )}

      <div className="flex-1" />

      {/* 生成上传链接 */}
      <button
        onClick={onCreateUploadLink}
        title="生成 24 小时上传链接，分享给他人上传文件"
        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
      >
        <Link2 className="w-4 h-4" />
      </button>

      {/* 刷新 */}
      <button
        onClick={onRefresh}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
        title="刷新"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* 排序 */}
      <div ref={sortRef} className="relative">
        <button
          onClick={() => setSortOpen((v) => !v)}
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-slate-50 transition"
        >
          <span>{currentSortLabel}</span>
          <span className="text-slate-400 text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {sortOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-20 animate-fade-in">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  if (opt.key === sortKey) {
                    onSortChange(opt.key, sortOrder === 'asc' ? 'desc' : 'asc')
                  } else {
                    onSortChange(opt.key, 'asc')
                  }
                  setSortOpen(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition',
                  sortKey === opt.key ? 'text-blue-600 font-medium' : 'text-slate-700'
                )}
              >
                {opt.label}
                {sortKey === opt.key && (
                  <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 视图切换 */}
      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => onViewModeChange('grid')}
          className={cn(
            'p-1.5 transition',
            viewMode === 'grid'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-400 hover:text-slate-600'
          )}
          title="网格视图"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={cn(
            'p-1.5 transition',
            viewMode === 'list'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-slate-400 hover:text-slate-600'
          )}
          title="列表视图"
        >
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
