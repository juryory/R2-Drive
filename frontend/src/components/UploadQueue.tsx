import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { UploadTask } from '../types'
import { formatBytes } from '../lib/utils'
import { useState } from 'react'

interface Props {
  uploads: UploadTask[]
  onClear: () => void
}

export default function UploadQueue({ uploads, onClear }: Props) {
  const [minimized, setMinimized] = useState(false)

  const doneCount = uploads.filter((t) => t.status === 'done').length
  const errorCount = uploads.filter((t) => t.status === 'error').length
  const total = uploads.length

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {doneCount === total && errorCount === 0
              ? '上传完成'
              : `上传中 ${doneCount}/${total}`}
          </p>
          {errorCount > 0 && (
            <p className="text-xs text-red-500">{errorCount} 个失败</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized((v) => !v)}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition text-xs"
          >
            {minimized ? '展开' : '折叠'}
          </button>
          <button
            onClick={onClear}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 文件列表 */}
      {!minimized && (
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
          {uploads.map((task) => (
            <div key={task.id} className="px-4 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="shrink-0">
                  {task.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {task.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                  {(task.status === 'uploading' || task.status === 'pending') && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>
                <p className="text-sm text-slate-700 truncate flex-1" title={task.file.name}>
                  {task.file.name}
                </p>
                <span className="text-xs text-slate-400 shrink-0">
                  {formatBytes(task.file.size)}
                </span>
              </div>

              {task.status === 'uploading' && (
                <div className="ml-6">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-200"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{task.progress}%</p>
                </div>
              )}

              {task.status === 'error' && task.error && (
                <p className="text-xs text-red-500 ml-6 mt-0.5 truncate">{task.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
