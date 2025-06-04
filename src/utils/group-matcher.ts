/**
 * Optimized group matcher with compiled regex cache and LRU eviction
 */

import { Config } from '../types';
import { logDebug } from './log';

export class GroupMatcher {
    private static readonly MAX_CACHE_SIZE = 500; // Reasonable limit for group cache
    private groupCache = new Map<string, string>();
    private compiledPatterns: { name: string; pattern: RegExp }[] = [];
    private defaultGroup: string;
    private cacheHits = 0;
    private cacheMisses = 0;

    constructor(groups: Config['groups']) {
        // Pre-compile all patterns and store them in order
        // Sort by the 'order' field to respect user-defined priority
        this.compiledPatterns = groups
            .slice() // Create a copy to avoid mutating the original
            .sort((a, b) => a.order - b.order) // Sort by order field
            .filter(g => g.match)
            .map(g => ({ name: g.name, pattern: g.match! }));

        const defaultGroupObj = groups.find(g => g.isDefault);
        this.defaultGroup = defaultGroupObj ? defaultGroupObj.name : 'Misc';
    }

    /**
     * Get group for import source with LRU caching
     */
    getGroup(source: string): string {
        // Check cache first
        const cached = this.groupCache.get(source);
        if (cached) {
            this.cacheHits++;
            // LRU: Move to end by re-inserting
            this.groupCache.delete(source);
            this.groupCache.set(source, cached);
            return cached;
        }

        this.cacheMisses++;

        // Test against compiled patterns
        let matchedGroup = this.defaultGroup;
        for (const { name, pattern } of this.compiledPatterns) {
            if (pattern.test(source)) {
                matchedGroup = name;
                break;
            }
        }

        // Add to cache with LRU eviction
        this.addToCache(source, matchedGroup);
        return matchedGroup;
    }

    /**
     * Add entry to cache with LRU eviction when size limit is reached
     */
    private addToCache(source: string, group: string): void {
        // Evict oldest entries if cache is at capacity
        if (this.groupCache.size >= GroupMatcher.MAX_CACHE_SIZE) {
            const entriesToEvict = Math.max(1, Math.floor(GroupMatcher.MAX_CACHE_SIZE * 0.2)); // Evict 20%
            const keysToDelete = Array.from(this.groupCache.keys()).slice(0, entriesToEvict);
            
            for (const key of keysToDelete) {
                this.groupCache.delete(key);
            }

            logDebug(`GroupMatcher cache evicted ${entriesToEvict} entries. Cache size: ${this.groupCache.size}`);
        }

        this.groupCache.set(source, group);
    }

    /**
     * Clear cache (useful when configuration changes)
     */
    clearCache(): void {
        this.groupCache.clear();
        this.cacheHits = 0;
        this.cacheMisses = 0;
        logDebug('GroupMatcher cache cleared');
    }

    /**
     * Get cache statistics with accurate hit rate
     */
    getCacheStats(): { size: number; maxSize: number; hitRate: number; hits: number; misses: number } {
        const totalRequests = this.cacheHits + this.cacheMisses;
        return {
            size: this.groupCache.size,
            maxSize: GroupMatcher.MAX_CACHE_SIZE,
            hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
            hits: this.cacheHits,
            misses: this.cacheMisses
        };
    }

    /**
     * Dispose of the GroupMatcher and clean up resources
     */
    dispose(): void {
        this.clearCache();
        this.compiledPatterns = [];
        logDebug('GroupMatcher disposed');
    }

    /**
     * Log cache statistics for debugging purposes
     */
    logCacheStats(): void {
        const stats = this.getCacheStats();
        logDebug(`GroupMatcher cache stats: size=${stats.size}/${stats.maxSize}, hitRate=${(stats.hitRate * 100).toFixed(1)}%, hits=${stats.hits}, misses=${stats.misses}`);
    }
}