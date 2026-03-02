export interface FileItem {
  type: 'file'
  key: string
  name: string
  size: number
  uploaded: string
  contentType: string
}

export interface FolderItem {
  type: 'folder'
  key: string
  name: string
}

export type FileSystemItem = FileItem | FolderItem

export interface UploadTask {
  id: string
  file: File
  prefix: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export interface StorageStats {
  totalSize: number
  fileCount: number
}

export interface ListResponse {
  folders: FolderItem[]
  files: FileItem[]
  prefix: string
}
