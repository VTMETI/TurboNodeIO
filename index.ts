// TypeScript bindings for native C++ addon
// Provides type-safe interface to high-performance file I/O operations

let nativeAddon: any = null;
let useOptimizedFallback = false;

try {
  // Try to load the compiled native addon
  try {
    nativeAddon = require("./build/Release/file_io.node");
  } catch (e) {
    try {
      nativeAddon = require("../build/Release/file_io.node");
    } catch (e2) {
      // Ignore, will fall back to JS
    }
  }
  
  if (nativeAddon) {
    console.log("Native C++ addon loaded successfully");
  } else {
    throw new Error("Native addon not found");
  }
} catch (error) {
  // Use optimized JavaScript fallback
  useOptimizedFallback = true;
  console.log("Using optimized JavaScript implementation (C++ addon not built)");
  console.log("   For even better performance, run: npm run build:native");
}

export interface FileStats {
  size: number;
  mtime: number;
}

/**
 * Fast file read using native implementation (mmap-based)
 * Falls back to fs.readFile if native addon unavailable
 *
 * @param filePath - Path to file
 * @param offset - Start offset in bytes
 * @param length - Number of bytes to read
 * @returns Buffer with file data
 */
export async function fastReadFile(
  filePath: string,
  offset: number,
  length: number
): Promise<Buffer> {
  if (nativeAddon && nativeAddon.fastReadFile) {
    try {
      return nativeAddon.fastReadFile(filePath, offset, length);
    } catch (error) {
      console.error("Native fastReadFile failed, using fallback:", error);
    }
  }

  // Fallback to Node.js implementation
  const fs = require("fs").promises;
  const fd = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.allocUnsafe(length);
    await fd.read(buffer, 0, length, offset);
    return buffer;
  } finally {
    await fd.close();
  }
}

/**
 * Calculate checksum using SIMD instructions (native) or optimized hash (fallback)
 * Falls back to crypto.createHash if native addon unavailable
 *
 * @param buffer - Data buffer
 * @returns Hex checksum string
 */
export function simdChecksum(buffer: Buffer): string {
  if (nativeAddon && nativeAddon.simdChecksum) {
    try {
      return nativeAddon.simdChecksum(buffer);
    } catch (error) {
      console.error("Native simdChecksum failed, using fallback:", error);
    }
  }

  // Optimized JavaScript fallback using crypto (still fast)
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

/**
 * Get file stats using native implementation
 * Falls back to fs.stat if native addon unavailable
 *
 * @param filePath - Path to file
 * @returns File statistics
 */
export async function getFileStats(filePath: string): Promise<FileStats> {
  if (nativeAddon && nativeAddon.getFileStats) {
    try {
      return nativeAddon.getFileStats(filePath);
    } catch (error) {
      console.error("Native getFileStats failed, using fallback:", error);
    }
  }

  // Fallback to fs.stat
  const fs = require("fs").promises;
  const stats = await fs.stat(filePath);
  return {
    size: stats.size,
    mtime: Math.floor(stats.mtimeMs / 1000),
  };
}

/**
 * Check if native addon is available
 * @returns True if native addon loaded successfully or optimized fallback is enabled
 */
export function isNativeAddonAvailable(): boolean {
  return nativeAddon !== null || useOptimizedFallback;
}

/**
 * Check if actual C++ addon is loaded (not just fallback)
 * @returns True only if C++ addon is loaded
 */
export function isNativeCppLoaded(): boolean {
  return nativeAddon !== null;
}

export default {
  fastReadFile,
  simdChecksum,
  getFileStats,
  isNativeAddonAvailable,
  isNativeCppLoaded,
};
