import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { FileItem } from '../types'
import { isImage, isVideo, isAudio, isPDF, isText, formatBytes, formatDate } from '../lib/utils'
import { api } from '../lib/api'
import FileIcon from './FileIcon'

interface Props {
  item: FileItem
  onClose: () => void
  onDownload: () => void
}

export default function PreviewModal({ item, onClose, onDownload }: Props) {
  const [zoom, setZoom] = useState(1)
  const previewUrl = api.getPreviewUrl(item.key)

  const image = isImage(item.contentType, item.name)
  const video = isVideo(item.contentType, item.name)
  const audio = isAudio(item.contentType, item.name)
  const pdf = isPDF(item.contentType, item.name)
  const text = isText(item.contentType, item.name)

  const canPreview = image || video || audio || pdf || text

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗主体 */}
      <div className="relative flex flex-col bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-slide-up">
        {/* 顶栏 */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200 shrink-0">
          <FileIcon
            name={item.name}
            contentType={item.contentType}
            className="w-7 h-7"
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 truncate text-sm">{item.name}</p>
            <p className="text-xs text-slate-400">
              {formatBytes(item.size)} · {formatDate(item.uploaded)}
            </p>
          </div>

          {/* 图片缩放控制 */}
          {image && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"
                title="缩小"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"
                title="放大"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"
                title="重置"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-900/5 min-h-0">
          {image && (
            <div className="overflow-auto w-full h-full flex items-center justify-center p-4">
              <img
                src={previewUrl}
                alt={item.name}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}

          {video && (
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-w-full max-h-full"
            />
          )}

          {audio && (
            <div className="flex flex-col items-center gap-6 p-8">
              <FileIcon name={item.name} contentType={item.contentType} className="w-24 h-24" />
              <p className="text-lg font-medium text-slate-700">{item.name}</p>
              <audio src={previewUrl} controls autoPlay className="w-full max-w-sm" />
            </div>
          )}

          {pdf && (
            <iframe
              src={`${previewUrl}#toolbar=1`}
              className="w-full h-full border-0"
              title={item.name}
            />
          )}

          {text && !image && !video && !audio && !pdf && (
            <TextPreview url={previewUrl} />
          )}

          {!canPreview && (
            <div className="flex flex-col items-center gap-4 p-12 text-center">
              <FileIcon name={item.name} contentType={item.contentType} className="w-20 h-20" />
              <div>
                <p className="text-slate-700 font-medium text-lg">{item.name}</p>
                <p className="text-slate-400 text-sm mt-1">{formatBytes(item.size)}</p>
                <p className="text-slate-400 text-sm mt-3">此文件类型暂不支持预览</p>
              </div>
              <button
                onClick={onDownload}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
              >
                <Download className="w-4 h-4" />
                下载文件
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useState(() => {
    fetch(url)
      .then((r) => r.text())
      .then((t) => setContent(t))
      .catch(() => setContent('加载失败'))
      .finally(() => setLoading(false))
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <pre className="w-full h-full overflow-auto p-6 text-sm text-slate-700 font-mono whitespace-pre-wrap bg-white">
      {content}
    </pre>
  )
}
