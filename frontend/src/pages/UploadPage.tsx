import { useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HardDrive, Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes } from '../lib/utils'

type State = 'idle' | 'uploading' | 'done' | 'error' | 'expired'

interface UploadResult {
  name: string
  size: number
}

export default function UploadPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [state, setState] = useState<State>(token ? 'idle' : 'expired')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setState('uploading')
    setProgress(0)
    setErrorMsg('')
    try {
      const res = await api.publicUpload(token, file, setProgress)
      setResult({ name: res.name, size: res.size })
      setState('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上传失败'
      if (msg.includes('过期') || msg.includes('无效') || msg.includes('401')) {
        setState('expired')
      } else {
        setErrorMsg(msg)
        setState('error')
      }
    }
  }, [token])

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && state !== 'uploading') handleFile(file)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-800 text-xl">R2 Drive</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {/* 链接过期 */}
          {state === 'expired' && (
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-800 mb-1">链接已过期或无效</h2>
              <p className="text-sm text-slate-500">请联系文件分享者重新生成上传链接</p>
            </div>
          )}

          {/* 上传成功 */}
          {state === 'done' && result && (
            <div className="text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-800 mb-1">上传成功</h2>
              <p className="text-sm text-slate-600 truncate">{result.name}</p>
              <p className="text-xs text-slate-400 mt-1">{formatBytes(result.size)}</p>
              <button
                onClick={() => { setState('idle'); setResult(null) }}
                className="mt-5 text-sm text-blue-600 hover:text-blue-800 transition"
              >
                继续上传
              </button>
            </div>
          )}

          {/* 上传出错 */}
          {state === 'error' && (
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-slate-800 mb-1">上传失败</h2>
              <p className="text-sm text-red-500 mb-4">{errorMsg}</p>
              <button
                onClick={() => setState('idle')}
                className="text-sm text-blue-600 hover:text-blue-800 transition"
              >
                重试
              </button>
            </div>
          )}

          {/* 上传中 */}
          {state === 'uploading' && (
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-blue-500 mx-auto mb-3 animate-spin" />
              <h2 className="text-lg font-semibold text-slate-800 mb-3">上传中...</h2>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400 mt-2">{progress}%</p>
            </div>
          )}

          {/* 待上传 */}
          {state === 'idle' && (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-1 text-center">上传文件</h2>
              <p className="text-sm text-slate-500 text-center mb-6">将文件拖入此处，或点击选择文件</p>

              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
                  dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">点击或拖拽文件到此处</p>
                <p className="text-xs text-slate-300 mt-1">单个文件最大 100MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onInputChange}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
