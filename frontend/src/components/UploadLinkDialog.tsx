import { useState } from 'react'
import { X, Copy, CheckCircle2, Link2 } from 'lucide-react'

interface Props {
  token: string
  expiresAt: string
  onClose: () => void
}

export default function UploadLinkDialog({ token, expiresAt, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  const uploadUrl = `${window.location.origin}/upload?token=${encodeURIComponent(token)}`

  const expireDate = new Date(expiresAt)
  const expireStr = expireDate.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  function copyLink() {
    navigator.clipboard.writeText(uploadUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800">分享上传链接</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          将此链接分享给他人，对方无需登录即可上传文件。链接 24 小时后失效，上传的文件将保留 1 个月。
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3">
          <p className="text-xs text-slate-400 mb-1">上传链接</p>
          <p className="text-sm text-slate-700 break-all leading-relaxed">{uploadUrl}</p>
        </div>

        <p className="text-xs text-amber-600 mb-5">
          有效期至 {expireStr}
        </p>

        <button
          onClick={copyLink}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition"
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              已复制
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              复制链接
            </>
          )}
        </button>
      </div>
    </div>
  )
}
