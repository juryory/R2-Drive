import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { HardDrive, X } from 'lucide-react'
import { api } from '../lib/api'
import { FileSystemItem, FileItem, UploadTask, StorageStats } from '../types'
import { generateId } from '../lib/utils'
import Topbar from '../components/Topbar'
import Breadcrumb from '../components/Breadcrumb'
import Toolbar from '../components/Toolbar'
import FileGrid from '../components/FileGrid'
import FileList from '../components/FileList'
import UploadZone from '../components/UploadZone'
import UploadQueue from '../components/UploadQueue'
import UploadLinkDialog from '../components/UploadLinkDialog'
import NewFolderDialog from '../components/NewFolderDialog'
import DeleteConfirmDialog from '../components/DeleteConfirmDialog'
import PreviewModal from '../components/PreviewModal'
import RenameDialog from '../components/RenameDialog'
import { Toast, ToastProvider, useToast } from '../components/Toast'

export type ViewMode = 'grid' | 'list'
export type SortKey = 'name' | 'size' | 'date'
export type SortOrder = 'asc' | 'desc'

function DashboardInner() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState<FileSystemItem[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [uploads, setUploads] = useState<UploadTask[]>([])
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [spaceMode, setSpaceMode] = useState(false)

  // 对话框状态
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null)
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null)
  const [renameItem, setRenameItem] = useState<FileSystemItem | null>(null)
  const [uploadLinkInfo, setUploadLinkInfo] = useState<{ token: string; expiresAt: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const quickUploadRef = useRef<HTMLInputElement>(null)

  // 空间管理模式：加载所有文件
  const enterSpaceMode = useCallback(async () => {
    setSpaceMode(true)
    setLoading(true)
    setSelectedKeys(new Set())
    setSortKey('size')
    setSortOrder('desc')
    try {
      const res = await api.listAllFiles()
      setItems(res.files)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // 加载当前目录文件列表
  const loadFiles = useCallback(async (path: string) => {
    setLoading(true)
    setSelectedKeys(new Set())
    try {
      const res = await api.listFiles(path)
      const allItems: FileSystemItem[] = [
        ...res.folders,
        ...res.files,
      ]
      setItems(allItems)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  function exitSpaceMode() {
    setSpaceMode(false)
    setSortKey('name')
    setSortOrder('asc')
    loadFiles(currentPath)
  }

  // 加载存储统计
  const loadStats = useCallback(async () => {
    try {
      const s = await api.getStats()
      setStats(s)
    } catch {
      // 忽略统计失败
    }
  }, [])

  useEffect(() => {
    loadFiles(currentPath)
  }, [currentPath, loadFiles])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // 排序后的文件列表
  const sortedItems = [...items]
    .filter((item) => {
      if (!searchQuery) return true
      return item.name.toLowerCase().includes(searchQuery.toLowerCase())
    })
    .sort((a, b) => {
      // 文件夹始终排在前面
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1

      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'zh-CN')
      } else if (sortKey === 'size') {
        const sa = a.type === 'file' ? a.size : 0
        const sb = b.type === 'file' ? b.size : 0
        cmp = sa - sb
      } else if (sortKey === 'date') {
        const da = a.type === 'file' ? new Date(a.uploaded).getTime() : 0
        const db = b.type === 'file' ? new Date(b.uploaded).getTime() : 0
        cmp = da - db
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })

  // 进入文件夹
  function navigateTo(path: string) {
    if (spaceMode) setSpaceMode(false)
    setCurrentPath(path)
    setSearchQuery('')
  }

  // 退出登录
  function handleLogout() {
    api.logout()
    navigate('/login', { replace: true })
  }

  // 简易上传（drive/{year}{month}/，带哈希命名）
  async function handleQuickUpload(files: File[]) {
    const tasks: UploadTask[] = files.map((file) => ({
      id: generateId(),
      file,
      prefix: 'drive/',
      progress: 0,
      status: 'pending',
    }))
    setUploads((prev) => [...prev, ...tasks])
    for (const task of tasks) {
      setUploads((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'uploading' } : t)))
      try {
        await api.quickUpload(task.file, (progress) => {
          setUploads((prev) => prev.map((t) => (t.id === task.id ? { ...t, progress } : t)))
        })
        setUploads((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'done', progress: 100 } : t)))
      } catch (err) {
        const message = err instanceof Error ? err.message : '上传失败'
        setUploads((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'error', error: message } : t)))
        showToast(`${task.file.name} 上传失败：${message}`, 'error')
      }
    }
    await loadStats()
    setTimeout(() => { setUploads((prev) => prev.filter((t) => t.status !== 'done')) }, 3000)
  }

  // 生成上传链接
  async function handleCreateUploadLink() {
    try {
      const res = await api.createUploadLink()
      setUploadLinkInfo(res)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '生成失败', 'error')
    }
  }

  // 上传文件
  async function handleUploadFiles(files: File[]) {
    const tasks: UploadTask[] = files.map((file) => ({
      id: generateId(),
      file,
      prefix: currentPath,
      progress: 0,
      status: 'pending',
    }))

    setUploads((prev) => [...prev, ...tasks])

    for (const task of tasks) {
      setUploads((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'uploading' } : t))
      )

      try {
        await api.uploadFile(task.file, task.prefix, (progress) => {
          setUploads((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, progress } : t))
          )
        })

        setUploads((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'done', progress: 100 } : t))
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : '上传失败'
        setUploads((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: 'error', error: message } : t))
        )
        showToast(`${task.file.name} 上传失败：${message}`, 'error')
      }
    }

    // 上传完成后刷新列表和统计
    await loadFiles(currentPath)
    await loadStats()

    // 3 秒后清除已完成的上传任务
    setTimeout(() => {
      setUploads((prev) => prev.filter((t) => t.status !== 'done'))
    }, 3000)
  }

  // 创建文件夹
  async function handleCreateFolder(name: string) {
    const path = `${currentPath}${name}/`
    try {
      await api.createFolder(path)
      showToast(`文件夹 "${name}" 创建成功`, 'success')
      await loadFiles(currentPath)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建失败', 'error')
    }
  }

  // 删除文件/文件夹
  async function handleDelete(keys: string[]) {
    try {
      await api.deleteFiles(keys)
      const count = keys.length
      showToast(`已删除 ${count} 个项目`, 'success')
      setSelectedKeys(new Set())
      if (spaceMode) await enterSpaceMode()
      else await loadFiles(currentPath)
      await loadStats()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败', 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  // 重命名
  async function handleRename(newName: string) {
    if (!renameItem) return
    const oldKey = renameItem.key
    let newKey: string

    if (renameItem.type === 'folder') {
      // 文件夹重命名：获取父路径，替换最后一段
      const parentPath = oldKey.slice(0, oldKey.lastIndexOf('/', oldKey.length - 2) + 1)
      newKey = `${parentPath}${newName}/`
    } else {
      const parentPath = oldKey.slice(0, oldKey.lastIndexOf('/') + 1)
      newKey = `${parentPath}${newName}`
    }

    try {
      await api.renameFile(oldKey, newKey)
      showToast('重命名成功', 'success')
      await loadFiles(currentPath)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '重命名失败', 'error')
    } finally {
      setRenameItem(null)
    }
  }

  // 下载文件
  function handleDownload(item: FileItem) {
    const url = api.getDownloadUrl(item.key)
    const a = document.createElement('a')
    a.href = url
    a.download = item.name
    a.click()
  }

  // 复制链接
  function handleCopyLink(item: FileItem) {
    const url = api.getPreviewUrl(item.key)
    navigator.clipboard.writeText(url).then(() => {
      showToast('链接已复制到剪贴板', 'success')
    })
  }

  // 选择操作
  function toggleSelect(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll() {
    if (selectedKeys.size === sortedItems.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(sortedItems.map((i) => i.key)))
    }
  }

  const selectedItems = sortedItems.filter((i) => selectedKeys.has(i.key))

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* 顶栏 */}
      <Topbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stats={stats}
        onLogout={handleLogout}
        onSortBySize={enterSpaceMode}
      />

      {/* 面包屑 */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white">
        <Breadcrumb currentPath={currentPath} onNavigate={navigateTo} />
      </div>

      {/* 工具栏 */}
      <Toolbar
        selectedCount={selectedKeys.size}
        totalCount={sortedItems.length}
        viewMode={viewMode}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onViewModeChange={setViewMode}
        onSortChange={(key, order) => { setSortKey(key); setSortOrder(order) }}
        onUploadClick={() => fileInputRef.current?.click()}
        onNewFolder={() => setShowNewFolder(true)}
        onDeleteSelected={() => {
          if (selectedKeys.size > 0) {
            setDeleteTarget(Array.from(selectedKeys))
          }
        }}
        onSelectAll={selectAll}
        onRefresh={() => spaceMode ? enterSpaceMode() : loadFiles(currentPath)}
        onQuickUpload={() => quickUploadRef.current?.click()}
        onCreateUploadLink={handleCreateUploadLink}
      />

      {/* 隐藏的 file input（普通上传） */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) handleUploadFiles(files)
          e.target.value = ''
        }}
      />

      {/* 隐藏的 file input（简易上传） */}
      <input
        ref={quickUploadRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) handleQuickUpload(files)
          e.target.value = ''
        }}
      />

      {/* 空间管理模式提示栏 */}
      {spaceMode && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 shrink-0">
          <HardDrive className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm font-medium text-amber-700">空间管理模式</span>
          <span className="text-sm text-amber-600">· 全部 {sortedItems.length} 个文件，可按大小 / 时间排序后批量删除</span>
          <div className="flex-1" />
          <button
            onClick={exitSpaceMode}
            className="flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900 font-medium transition"
          >
            <X className="w-3.5 h-3.5" />
            退出
          </button>
        </div>
      )}

      {/* 主内容区 + 拖拽上传 */}
      <UploadZone onFileDrop={handleUploadFiles} className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <div className="text-4xl mb-3">📂</div>
              <p className="font-medium">{searchQuery ? '没有匹配的文件' : '此文件夹为空'}</p>
              <p className="text-sm mt-1">
                {searchQuery ? '换个关键词试试' : '将文件拖拽到此处，或点击上传按钮'}
              </p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <FileGrid
            items={sortedItems}
            selectedKeys={selectedKeys}
            onSelect={toggleSelect}
            onOpen={(item) => {
              if (item.type === 'folder') navigateTo(item.key)
              else setPreviewItem(item)
            }}
            onDownload={handleDownload}
            onDelete={(item) => setDeleteTarget([item.key])}
            onRename={(item) => setRenameItem(item)}
            onCopyLink={handleCopyLink}
          />
        ) : (
          <FileList
            items={sortedItems}
            selectedKeys={selectedKeys}
            onSelect={toggleSelect}
            onOpen={(item) => {
              if (item.type === 'folder') navigateTo(item.key)
              else setPreviewItem(item)
            }}
            onDownload={handleDownload}
            onDelete={(item) => setDeleteTarget([item.key])}
            onRename={(item) => setRenameItem(item)}
            onCopyLink={handleCopyLink}
          />
        )}
      </UploadZone>

      {/* 上传队列 */}
      {uploads.length > 0 && (
        <UploadQueue
          uploads={uploads}
          onClear={() => setUploads((prev) => prev.filter((t) => t.status === 'uploading'))}
        />
      )}

      {/* 弹窗 */}
      <NewFolderDialog
        open={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onCreate={handleCreateFolder}
      />

      {deleteTarget && (
        <DeleteConfirmDialog
          items={selectedItems.length > 0 ? selectedItems : sortedItems.filter((i) => deleteTarget.includes(i.key))}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onDownload={() => handleDownload(previewItem)}
        />
      )}

      {renameItem && (
        <RenameDialog
          item={renameItem}
          onClose={() => setRenameItem(null)}
          onRename={handleRename}
        />
      )}

      {uploadLinkInfo && (
        <UploadLinkDialog
          token={uploadLinkInfo.token}
          expiresAt={uploadLinkInfo.expiresAt}
          onClose={() => setUploadLinkInfo(null)}
        />
      )}
    </div>
  )
}

export default function Dashboard() {
  return (
    <ToastProvider>
      <DashboardInner />
      <Toast />
    </ToastProvider>
  )
}
