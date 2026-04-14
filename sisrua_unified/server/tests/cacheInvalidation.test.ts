import {
  setCachedFilename,
  getCachedFilename,
  clearCache,
  tagCacheEntry,
  invalidateCacheByTag,
  invalidateCacheByPattern,
  onRoleChange
} from '../services/cacheService';

describe('cacheInvalidation', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('tagCacheEntry', () => {
    it('should tag a cached entry', () => {
      setCachedFilename('key1', 'file1.dxf');
      tagCacheEntry('key1', ['role:admin']);
      // Verify tag works by invalidating
      const removed = invalidateCacheByTag('role:admin');
      expect(removed).toBe(1);
      expect(getCachedFilename('key1')).toBeNull();
    });

    it('should not throw when tagging a non-existent key', () => {
      expect(() => tagCacheEntry('ghost-key', ['tag1'])).not.toThrow();
    });

    it('should merge tags without duplicates', () => {
      setCachedFilename('key2', 'file2.dxf');
      tagCacheEntry('key2', ['t1', 't2']);
      tagCacheEntry('key2', ['t2', 't3']);
      // All three distinct tags should be present
      expect(invalidateCacheByTag('t3')).toBe(1);
    });

    it('should support multiple tags on a single entry', () => {
      setCachedFilename('key3', 'file3.dxf');
      tagCacheEntry('key3', ['tagA', 'tagB']);
      expect(invalidateCacheByTag('tagA')).toBe(1);
      expect(getCachedFilename('key3')).toBeNull();
    });
  });

  describe('invalidateCacheByTag', () => {
    it('should remove all entries with a given tag', () => {
      setCachedFilename('k1', 'a.dxf');
      setCachedFilename('k2', 'b.dxf');
      setCachedFilename('k3', 'c.dxf');
      tagCacheEntry('k1', ['shared']);
      tagCacheEntry('k2', ['shared']);
      const count = invalidateCacheByTag('shared');
      expect(count).toBe(2);
      expect(getCachedFilename('k1')).toBeNull();
      expect(getCachedFilename('k2')).toBeNull();
      expect(getCachedFilename('k3')).toBe('c.dxf');
    });

    it('should return 0 when no entries have the tag', () => {
      setCachedFilename('k4', 'd.dxf');
      expect(invalidateCacheByTag('nonexistent-tag')).toBe(0);
    });

    it('should not affect entries without the tag', () => {
      setCachedFilename('k5', 'e.dxf');
      setCachedFilename('k6', 'f.dxf');
      tagCacheEntry('k5', ['remove-me']);
      invalidateCacheByTag('remove-me');
      expect(getCachedFilename('k6')).toBe('f.dxf');
    });
  });

  describe('invalidateCacheByPattern', () => {
    it('should remove entries matching a string pattern', () => {
      setCachedFilename('user_42_data', 'u42.dxf');
      setCachedFilename('user_99_data', 'u99.dxf');
      setCachedFilename('other_key', 'other.dxf');
      const count = invalidateCacheByPattern('user_42');
      expect(count).toBe(1);
      expect(getCachedFilename('user_42_data')).toBeNull();
      expect(getCachedFilename('other_key')).toBe('other.dxf');
    });

    it('should remove entries matching a RegExp pattern', () => {
      setCachedFilename('user_1_abc', 'f1.dxf');
      setCachedFilename('user_2_abc', 'f2.dxf');
      setCachedFilename('admin_abc', 'fa.dxf');
      const count = invalidateCacheByPattern(/^user_\d+/);
      expect(count).toBe(2);
      expect(getCachedFilename('admin_abc')).toBe('fa.dxf');
    });

    it('should return 0 when no keys match', () => {
      setCachedFilename('no_match_key', 'nm.dxf');
      expect(invalidateCacheByPattern('xyz_nomatch')).toBe(0);
    });

    it('should handle pattern that matches all keys', () => {
      setCachedFilename('alpha', 'a.dxf');
      setCachedFilename('beta', 'b.dxf');
      const count = invalidateCacheByPattern(/.*/);
      expect(count).toBe(2);
    });
  });

  describe('onRoleChange', () => {
    it('should invalidate tag-based entries for the user', () => {
      setCachedFilename('some_key', 'data.dxf');
      tagCacheEntry('some_key', ['user:77']);
      onRoleChange('77');
      expect(getCachedFilename('some_key')).toBeNull();
    });

    it('should invalidate pattern-based entries for the user', () => {
      setCachedFilename('user_55_result', 'r55.dxf');
      onRoleChange('55');
      expect(getCachedFilename('user_55_result')).toBeNull();
    });

    it('should not affect entries belonging to other users', () => {
      setCachedFilename('user_10_result', 'r10.dxf');
      setCachedFilename('user_20_result', 'r20.dxf');
      tagCacheEntry('user_10_result', ['user:10']);
      onRoleChange('20');
      expect(getCachedFilename('user_10_result')).toBe('r10.dxf');
    });

    it('should not throw when no entries exist for the user', () => {
      expect(() => onRoleChange('999')).not.toThrow();
    });
  });
});
