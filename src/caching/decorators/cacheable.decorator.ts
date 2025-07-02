import { SetMetadata, applyDecorators } from "@nestjs/common"
import type { CacheOptions } from "../caching.service"

export const CACHEABLE_KEY = "cacheable"
export const CACHE_KEY_GENERATOR = "cache_key_generator"
export const CACHE_CONDITION = "cache_condition"

export interface CacheableOptions extends CacheOptions {
  keyGenerator?: (...args: any[]) => string
  condition?: (...args: any[]) => boolean
  unless?: (...args: any[]) => boolean
}

export function Cacheable(options: CacheableOptions = {}) {
  return applyDecorators(
    SetMetadata(CACHEABLE_KEY, options),
    SetMetadata(CACHE_KEY_GENERATOR, options.keyGenerator),
    SetMetadata(CACHE_CONDITION, options.condition),
  )
}

export function CacheEvict(options: { key?: string; pattern?: string; tags?: string[]; allEntries?: boolean } = {}) {
  return SetMetadata("cache_evict", options)
}

export function CachePut(options: CacheableOptions = {}) {
  return SetMetadata("cache_put", options)
}
