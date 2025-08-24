import { Injectable, Logger } from "@nestjs/common"
import type { EventEmitter2 } from "@nestjs/event-emitter"

export interface WebRTCPeer {
  id: string
  userId: string
  roomId: string
  isPublisher: boolean
  mediaTypes: {
    video: boolean
    audio: boolean
    screen: boolean
  }
  connectionState: "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed"
  createdAt: Date
}

export interface ICECandidate {
  candidate: string
  sdpMLineIndex?: number
  sdpMid?: string
}

export interface SessionDescription {
  type: "offer" | "answer"
  sdp: string
}

@Injectable()
export class WebRTCService {
  private readonly logger = new Logger("WebRTCService")
  private peers = new Map<string, WebRTCPeer>()
  private roomPeers = new Map<string, Set<string>>() // roomId -> Set of peerIds

  constructor(private eventEmitter: EventEmitter2) {}

  async createPeer(userId: string, roomId: string, isPublisher = false): Promise<WebRTCPeer> {
    const peerId = `${userId}_${roomId}_${Date.now()}`

    const peer: WebRTCPeer = {
      id: peerId,
      userId,
      roomId,
      isPublisher,
      mediaTypes: {
        video: false,
        audio: false,
        screen: false,
      },
      connectionState: "new",
      createdAt: new Date(),
    }

    this.peers.set(peerId, peer)

    // Add to room peers
    if (!this.roomPeers.has(roomId)) {
      this.roomPeers.set(roomId, new Set())
    }
    this.roomPeers.get(roomId).add(peerId)

    this.logger.log(`Created WebRTC peer ${peerId} for user ${userId} in room ${roomId}`)

    this.eventEmitter.emit("webrtc.peer.created", { peer })

    return peer
  }

  async handleOffer(peerId: string, offer: SessionDescription): Promise<SessionDescription> {
    const peer = this.peers.get(peerId)
    if (!peer) {
      throw new Error("Peer not found")
    }

    this.logger.log(`Handling offer for peer ${peerId}`)

    // In a real implementation, you would:
    // 1. Set the remote description
    // 2. Create an answer
    // 3. Set the local description
    // 4. Return the answer

    // For demo purposes, return a mock answer
    const answer: SessionDescription = {
      type: "answer",
      sdp: this.generateMockSDP("answer"),
    }

    peer.connectionState = "connecting"
    this.eventEmitter.emit("webrtc.offer.handled", { peerId, offer, answer })

    return answer
  }

  async handleAnswer(peerId: string, answer: SessionDescription): Promise<void> {
    const peer = this.peers.get(peerId)
    if (!peer) {
      throw new Error("Peer not found")
    }

    this.logger.log(`Handling answer for peer ${peerId}`)

    // In a real implementation, you would set the remote description
    peer.connectionState = "connected"
    this.eventEmitter.emit("webrtc.answer.handled", { peerId, answer })
  }

  async handleICECandidate(peerId: string, candidate: ICECandidate): Promise<void> {
    const peer = this.peers.get(peerId)
    if (!peer) {
      throw new Error("Peer not found")
    }

    this.logger.log(`Handling ICE candidate for peer ${peerId}`)

    // In a real implementation, you would add the ICE candidate
    this.eventEmitter.emit("webrtc.ice.candidate", { peerId, candidate })
  }

  async updateMediaTypes(
    peerId: string,
    mediaTypes: { video?: boolean; audio?: boolean; screen?: boolean },
  ): Promise<void> {
    const peer = this.peers.get(peerId)
    if (!peer) {
      throw new Error("Peer not found")
    }

    Object.assign(peer.mediaTypes, mediaTypes)

    this.logger.log(`Updated media types for peer ${peerId}:`, peer.mediaTypes)

    this.eventEmitter.emit("webrtc.media.updated", { peerId, mediaTypes: peer.mediaTypes })
  }

  async closePeer(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId)
    if (!peer) {
      return
    }

    peer.connectionState = "closed"

    // Remove from room peers
    const roomPeers = this.roomPeers.get(peer.roomId)
    if (roomPeers) {
      roomPeers.delete(peerId)
      if (roomPeers.size === 0) {
        this.roomPeers.delete(peer.roomId)
      }
    }

    this.peers.delete(peerId)

    this.logger.log(`Closed WebRTC peer ${peerId}`)

    this.eventEmitter.emit("webrtc.peer.closed", { peerId, userId: peer.userId, roomId: peer.roomId })
  }

  async getRoomPeers(roomId: string): Promise<WebRTCPeer[]> {
    const peerIds = this.roomPeers.get(roomId) || new Set()
    const peers: WebRTCPeer[] = []

    for (const peerId of peerIds) {
      const peer = this.peers.get(peerId)
      if (peer) {
        peers.push(peer)
      }
    }

    return peers
  }

  async getUserPeers(userId: string): Promise<WebRTCPeer[]> {
    const peers: WebRTCPeer[] = []

    for (const peer of this.peers.values()) {
      if (peer.userId === userId) {
        peers.push(peer)
      }
    }

    return peers
  }

  async getConnectionStats(peerId: string): Promise<{
    connectionState: string
    mediaTypes: any
    duration: number
  }> {
    const peer = this.peers.get(peerId)
    if (!peer) {
      throw new Error("Peer not found")
    }

    return {
      connectionState: peer.connectionState,
      mediaTypes: peer.mediaTypes,
      duration: Math.floor((Date.now() - peer.createdAt.getTime()) / 1000),
    }
  }

  private generateMockSDP(type: "offer" | "answer"): string {
    const timestamp = Date.now()
    return `v=0
o=- ${timestamp} 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1
a=msid-semantic: WMS
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:mock
a=ice-pwd:mockpassword
a=ice-options:trickle
a=fingerprint:sha-256 mock:fingerprint
a=setup:actpass
a=mid:0
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=sendrecv
a=msid:mock mocktrack
a=rtcp-mux
m=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102 121 127 120 125 107 108 109 124 119 123 118 114 115 116
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:mock
a=ice-pwd:mockpassword
a=ice-options:trickle
a=fingerprint:sha-256 mock:fingerprint
a=setup:actpass
a=mid:1
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset
a=sendrecv
a=msid:mock mocktrack
a=rtcp-mux`
  }
}
