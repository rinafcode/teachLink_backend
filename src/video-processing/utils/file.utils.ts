import * as fs from "fs/promises"
import * as path from "path"
import { createHash } from "crypto"

export class FileUtils {
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  static async getFileHash(filePath: string, algorithm = "sha256"): Promise<string> {
    const fileBuffer = await fs.readFile(filePath)
    const hash = createHash(algorithm)
    hash.update(fileBuffer)
    return hash.digest("hex")
  }

  static async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath)
    return stats.size
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  static async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      // Ignore file not found errors
      if (error.code !== "ENOENT") {
        throw error
      }
    }
  }

  static async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    await this.ensureDirectory(path.dirname(destinationPath))
    await fs.rename(sourcePath, destinationPath)
  }

  static async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    await this.ensureDirectory(path.dirname(destinationPath))
    await fs.copyFile(sourcePath, destinationPath)
  }

  static getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase()
  }

  static generateUniqueFilename(originalName: string, prefix = ""): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = this.getFileExtension(originalName)
    const baseName = path.basename(originalName, extension)
    return `${prefix}${baseName}_${timestamp}_${random}${extension}`
  }

  static formatFileSize(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`
  }

  static isVideoFile(mimeType: string): boolean {
    return mimeType.startsWith("video/")
  }

  static getVideoMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".mkv": "video/x-matroska",
      ".flv": "video/x-flv",
      ".wmv": "video/x-ms-wmv",
      ".m4v": "video/x-m4v",
    }
    return mimeTypes[extension.toLowerCase()] || "video/mp4"
  }

  static async cleanupOldFiles(directory: string, maxAgeMs: number): Promise<number> {
    let deletedCount = 0
    const cutoffTime = Date.now() - maxAgeMs

    try {
      const files = await fs.readdir(directory, { withFileTypes: true })

      for (const file of files) {
        const filePath = path.join(directory, file.name)

        if (file.isDirectory()) {
          deletedCount += await this.cleanupOldFiles(filePath, maxAgeMs)
        } else {
          const stats = await fs.stat(filePath)
          if (stats.mtime.getTime() < cutoffTime) {
            await this.deleteFile(filePath)
            deletedCount++
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be inaccessible
      console.warn(`Failed to cleanup directory ${directory}:`, error.message)
    }

    return deletedCount
  }
}
