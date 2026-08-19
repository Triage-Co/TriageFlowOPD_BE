import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  displayCacheKey,
  QUEUE_DISPLAY_CACHE_TTL_MS,
  QUEUE_REBALANCE_LAST_RUN_KEY,
  QUEUE_REBALANCE_THROTTLE_MS,
  QUEUE_RULES_VERSION_KEY,
} from './queue.constants';

@Injectable()
export class QueueCacheService {
  private readonly logger = new Logger(QueueCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async getRulesVersion(): Promise<number> {
    try {
      const raw = await this.cache.get<number | string>(
        QUEUE_RULES_VERSION_KEY,
      );
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw === 'string') {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) return parsed;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to read queue rulesVersion: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return 0;
  }

  async bumpRulesVersion(): Promise<void> {
    try {
      const current = await this.getRulesVersion();
      await this.cache.set(QUEUE_RULES_VERSION_KEY, current + 1);
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to bump queue rulesVersion: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getDisplayPayload<T>(roomId: string): Promise<T | undefined> {
    try {
      const version = await this.getRulesVersion();
      const cached = await this.cache.get<T>(displayCacheKey(roomId, version));
      return cached === null || cached === undefined ? undefined : cached;
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to read queue display cache for ${roomId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  async setDisplayPayload(roomId: string, payload: unknown): Promise<void> {
    try {
      const version = await this.getRulesVersion();
      await this.cache.set(
        displayCacheKey(roomId, version),
        payload,
        QUEUE_DISPLAY_CACHE_TTL_MS,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to write queue display cache for ${roomId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async invalidateRoom(roomId: string): Promise<void> {
    try {
      const version = await this.getRulesVersion();
      await this.cache.del(displayCacheKey(roomId, version));
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to invalidate queue display cache for ${roomId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Best-effort multi-instance throttle. cache-manager has no SET NX,
   * so two instances may still overlap; in-process isRunning is the real lock.
   */
  async tryBeginRebalanceRun(): Promise<boolean> {
    try {
      const lastRun = await this.cache.get(QUEUE_REBALANCE_LAST_RUN_KEY);
      if (lastRun !== undefined && lastRun !== null) {
        return false;
      }
      await this.cache.set(
        QUEUE_REBALANCE_LAST_RUN_KEY,
        Date.now(),
        QUEUE_REBALANCE_THROTTLE_MS,
      );
      return true;
    } catch (err: unknown) {
      this.logger.warn(
        `Failed rebalance lastRun throttle: ${err instanceof Error ? err.message : String(err)}`,
      );
      return true;
    }
  }
}
