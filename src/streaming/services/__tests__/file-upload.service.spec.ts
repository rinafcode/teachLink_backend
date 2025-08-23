import { Test, type TestingModule } from "@nestjs/testing"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { FileUploadService, FileCategory } from "../file-upload.service"
import * as fs from "fs/promises"
import * as path from "path"

jest.mock("fs/promises")
jest.mock("sharp", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from("processed-image")),
  })),
}))

describe("FileUploadService", () => {
  let service: FileUploadService

  const mockFile = {
    fieldname: "file",
    originalname: "test.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 1024,
    buffer: Buffer.from("test-image-data"),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FileUploadService],
    }).compile()

    service = module.get<FileUploadService>(FileUploadService)

    jest.clearAllMocks()
    ;(fs.access as jest.Mock).mockResolvedValue(undefined)
    ;(fs.mkdir as jest.Mock).mockResolvedValue(undefined)
    ;(fs.writeFile as jest.Mock).mockResolvedValue(undefined)
  })

  describe("uploadFile", () => {
    it("should upload file successfully", async () => {
      const result = await service.uploadFile(mockFile, FileCategory.IMAGE, "user-1")

      expect(result.originalName).toBe("test.jpg")
      expect(result.mimetype).toBe("image/jpeg")
      expect(result.category).toBe(FileCategory.IMAGE)
      expect(result.uploadedBy).toBe("user-1")
      expect(result.url).toMatch(/\/api\/files\/image\/.*\.jpg/)
      expect(fs.writeFile).toHaveBeenCalled()
    })

    it("should process avatar with resize and compression", async () => {
      const result = await service.uploadAvatar(mockFile, "user-1")

      expect(result.category).toBe(FileCategory.AVATAR)
      expect(result.size).toBeGreaterThan(0)
    })

    it("should throw BadRequestException for invalid file type", async () => {
      const invalidFile = {
        ...mockFile,
        originalname: "test.exe",
        mimetype: "application/x-executable",
      }

      await expect(service.uploadFile(invalidFile, FileCategory.IMAGE, "user-1")).rejects.toThrow(BadRequestException)
    })

    it("should throw BadRequestException for file too large", async () => {
      const largeFile = {
        ...mockFile,
        size: 200 * 1024 * 1024, // 200MB
      }

      await expect(service.uploadFile(largeFile, FileCategory.IMAGE, "user-1")).rejects.toThrow(BadRequestException)
    })

    it("should throw BadRequestException for executable files", async () => {
      const executableFile = {
        ...mockFile,
        originalname: "malicious.exe",
        mimetype: "image/jpeg", // Trying to disguise as image
      }

      await expect(service.uploadFile(executableFile, FileCategory.IMAGE, "user-1")).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe("getFile", () => {
    it("should return file buffer and mimetype", async () => {
      const mockBuffer = Buffer.from("file-content")
      ;(fs.readFile as jest.Mock).mockResolvedValue(mockBuffer)

      const result = await service.getFile(FileCategory.IMAGE, "test.jpg")

      expect(result.buffer).toEqual(mockBuffer)
      expect(result.mimetype).toBe("image/jpeg")
      expect(fs.readFile).toHaveBeenCalledWith(path.join("uploads", "image", "test.jpg"))
    })

    it("should throw NotFoundException if file not found", async () => {
      ;(fs.readFile as jest.Mock).mockRejectedValue(new Error("File not found"))

      await expect(service.getFile(FileCategory.IMAGE, "nonexistent.jpg")).rejects.toThrow(NotFoundException)
    })
  })

  describe("deleteFile", () => {
    it("should delete file successfully", async () => {
      ;(fs.unlink as jest.Mock).mockResolvedValue(undefined)

      await service.deleteFile(FileCategory.IMAGE, "test.jpg")

      expect(fs.unlink).toHaveBeenCalledWith(path.join("uploads", "image", "test.jpg"))
    })

    it("should throw NotFoundException if file not found", async () => {
      ;(fs.unlink as jest.Mock).mockRejectedValue(new Error("File not found"))

      await expect(service.deleteFile(FileCategory.IMAGE, "nonexistent.jpg")).rejects.toThrow(NotFoundException)
    })
  })

  describe("getFileStats", () => {
    it("should return file statistics", async () => {
      ;(fs.readdir as jest.Mock).mockResolvedValue(["file1.jpg", "file2.png"])
      ;(fs.stat as jest.Mock).mockResolvedValue({ size: 1024 })

      const result = await service.getFileStats()

      expect(result.totalFiles).toBeGreaterThan(0)
      expect(result.totalSize).toBeGreaterThan(0)
      expect(result.filesByCategory).toBeDefined()
    })
  })
})
