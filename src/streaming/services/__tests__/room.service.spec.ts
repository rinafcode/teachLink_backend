import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { RoomService } from "../room.service"
import { ParticipantService } from "../participant.service"
import { Room, RoomStatus, RoomType } from "../../entities/room.entity"
import { jest } from "@jest/globals"

describe("RoomService", () => {
  let service: RoomService
  let repository: Repository<Room>
  let participantService: ParticipantService

  const mockRoom: Room = {
    id: "room-1",
    title: "Test Room",
    description: "Test Description",
    type: RoomType.VIRTUAL_CLASSROOM,
    status: RoomStatus.SCHEDULED,
    scheduledStartTime: new Date(),
    scheduledEndTime: new Date(),
    actualStartTime: null,
    actualEndTime: null,
    maxParticipants: 100,
    isRecording: false,
    allowChat: true,
    allowScreenShare: true,
    allowParticipantVideo: false,
    allowParticipantAudio: false,
    streamKey: "stream-key-123",
    rtmpUrl: "rtmp://localhost:1935/live/stream-key-123",
    settings: {},
    instructorId: "instructor-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    instructor: null,
    participants: [],
    messages: [],
    recordings: [],
    whiteboardAnnotations: [],
  }

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  }

  const mockParticipantService = {
    endAllParticipants: jest.fn(),
    getRoomParticipants: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: getRepositoryToken(Room),
          useValue: mockRepository,
        },
        {
          provide: ParticipantService,
          useValue: mockParticipantService,
        },
      ],
    }).compile()

    service = module.get<RoomService>(RoomService)
    repository = module.get<Repository<Room>>(getRepositoryToken(Room))
    participantService = module.get<ParticipantService>(ParticipantService)

    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create a new room successfully", async () => {
      const roomData = {
        title: "New Room",
        description: "New Description",
        type: RoomType.VIRTUAL_CLASSROOM,
      }

      mockRepository.create.mockReturnValue({ ...roomData, id: "room-2" })
      mockRepository.save.mockResolvedValue({ ...roomData, id: "room-2" })

      const result = await service.create(roomData, "instructor-1")

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...roomData,
        instructorId: "instructor-1",
        streamKey: expect.any(String),
        rtmpUrl: expect.stringContaining("rtmp://localhost:1935/live/"),
      })
      expect(mockRepository.save).toHaveBeenCalled()
      expect(result.id).toBe("room-2")
    })
  })

  describe("findById", () => {
    it("should return room if found", async () => {
      mockRepository.findOne.mockResolvedValue(mockRoom)

      const result = await service.findById("room-1")

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: "room-1" },
        relations: ["instructor", "participants", "participants.user", "messages", "recordings"],
      })
      expect(result).toEqual(mockRoom)
    })

    it("should throw NotFoundException if room not found", async () => {
      mockRepository.findOne.mockResolvedValue(null)

      await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException)
    })
  })

  describe("startRoom", () => {
    it("should start room successfully", async () => {
      const scheduledRoom = { ...mockRoom, status: RoomStatus.SCHEDULED }
      mockRepository.findOne.mockResolvedValue(scheduledRoom)
      mockRepository.save.mockResolvedValue({ ...scheduledRoom, status: RoomStatus.LIVE })

      const result = await service.startRoom("room-1", "instructor-1")

      expect(result.status).toBe(RoomStatus.LIVE)
      expect(result.actualStartTime).toBeInstanceOf(Date)
    })

    it("should throw ForbiddenException if not instructor", async () => {
      mockRepository.findOne.mockResolvedValue(mockRoom)

      await expect(service.startRoom("room-1", "other-user")).rejects.toThrow(ForbiddenException)
    })

    it("should throw BadRequestException if room not scheduled", async () => {
      const liveRoom = { ...mockRoom, status: RoomStatus.LIVE }
      mockRepository.findOne.mockResolvedValue(liveRoom)

      await expect(service.startRoom("room-1", "instructor-1")).rejects.toThrow(BadRequestException)
    })
  })

  describe("endRoom", () => {
    it("should end room successfully", async () => {
      const liveRoom = { ...mockRoom, status: RoomStatus.LIVE }
      mockRepository.findOne.mockResolvedValue(liveRoom)
      mockRepository.save.mockResolvedValue({ ...liveRoom, status: RoomStatus.ENDED })
      mockParticipantService.endAllParticipants.mockResolvedValue(undefined)

      const result = await service.endRoom("room-1", "instructor-1")

      expect(result.status).toBe(RoomStatus.ENDED)
      expect(result.actualEndTime).toBeInstanceOf(Date)
      expect(mockParticipantService.endAllParticipants).toHaveBeenCalledWith("room-1")
    })

    it("should throw ForbiddenException if not instructor", async () => {
      const liveRoom = { ...mockRoom, status: RoomStatus.LIVE }
      mockRepository.findOne.mockResolvedValue(liveRoom)

      await expect(service.endRoom("room-1", "other-user")).rejects.toThrow(ForbiddenException)
    })
  })

  describe("joinRoom", () => {
    it("should allow joining live room with capacity", async () => {
      const liveRoom = {
        ...mockRoom,
        status: RoomStatus.LIVE,
        participants: [{ status: "joined" }, { status: "joined" }],
      }
      mockRepository.findOne.mockResolvedValue(liveRoom)

      const result = await service.joinRoom("room-1", "user-1")

      expect(result.canJoin).toBe(true)
      expect(result.room).toEqual(liveRoom)
    })

    it("should not allow joining non-live room", async () => {
      mockRepository.findOne.mockResolvedValue(mockRoom)

      const result = await service.joinRoom("room-1", "user-1")

      expect(result.canJoin).toBe(false)
      expect(result.reason).toBe("Room is not currently live")
    })

    it("should not allow joining room at capacity", async () => {
      const fullRoom = {
        ...mockRoom,
        status: RoomStatus.LIVE,
        maxParticipants: 2,
        participants: [{ status: "joined" }, { status: "joined" }],
      }
      mockRepository.findOne.mockResolvedValue(fullRoom)

      const result = await service.joinRoom("room-1", "user-1")

      expect(result.canJoin).toBe(false)
      expect(result.reason).toBe("Room is at maximum capacity")
    })
  })
})
