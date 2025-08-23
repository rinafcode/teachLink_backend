export class TimeUtils {
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  static parseDuration(durationString: string): number {
    const parts = durationString.split(":")
    if (parts.length === 2) {
      // MM:SS format
      return Number.parseInt(parts[0]) * 60 + Number.parseInt(parts[1])
    } else if (parts.length === 3) {
      // HH:MM:SS format
      return Number.parseInt(parts[0]) * 3600 + Number.parseInt(parts[1]) * 60 + Number.parseInt(parts[2])
    }
    return 0
  }

  static getTimestamp(): string {
    return new Date().toISOString()
  }

  static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000)
  }

  static addHours(date: Date, hours: number): Date {
    return new Date(date.getTime() + hours * 3600000)
  }

  static addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400000)
  }

  static isExpired(date: Date, expirationMinutes: number): boolean {
    const now = new Date()
    const expiration = this.addMinutes(date, expirationMinutes)
    return now > expiration
  }

  static getRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSeconds < 60) {
      return "just now"
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  static calculateETA(progress: number, startTime: Date): Date | null {
    if (progress <= 0 || progress >= 100) {
      return null
    }

    const now = new Date()
    const elapsedMs = now.getTime() - startTime.getTime()
    const totalEstimatedMs = (elapsedMs / progress) * 100
    const remainingMs = totalEstimatedMs - elapsedMs

    return new Date(now.getTime() + remainingMs)
  }

  static formatETA(eta: Date | null): string {
    if (!eta) {
      return "Unknown"
    }

    const now = new Date()
    const diffMs = eta.getTime() - now.getTime()
    const diffMinutes = Math.ceil(diffMs / 60000)

    if (diffMinutes < 1) {
      return "Less than a minute"
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""}`
    } else {
      const hours = Math.floor(diffMinutes / 60)
      const minutes = diffMinutes % 60
      return `${hours}h ${minutes}m`
    }
  }
}
