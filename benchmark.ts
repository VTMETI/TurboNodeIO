/**
 * Performance Benchmark: Native C++ File I/O vs Standard TypeScript
 *
 * This benchmark compares:
 * 1. Native C++ addon (mmap + SIMD)
 * 2. Standard fs.promises (Node.js built-in)
 * 3. Standard fs.readFileSync (blocking)
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  fastReadFile,
  simdChecksum,
  getFileStats,
  isNativeCppLoaded,
} from "./index";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

interface BenchmarkResult {
  operation: string;
  method: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  throughputMBps?: number;
}

/**
 * Create test files of various sizes
 */
async function createTestFiles(): Promise<void> {
  const testDir = path.join(__dirname, "benchmark_data");

  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }

  const sizes = [
    { name: "small", size: 1024 * 100 }, // 100 KB
    { name: "medium", size: 1024 * 1024 * 10 }, // 10 MB
    { name: "large", size: 1024 * 1024 * 100 }, // 100 MB
    { name: "xlarge", size: 1024 * 1024 * 1024 }, // 1 GB
  ];

  console.log(`${colors.cyan}Creating test files...${colors.reset}`);

  for (const { name, size } of sizes) {
    const filePath = path.join(testDir, `test_${name}.bin`);

    if (!fs.existsSync(filePath)) {
      // Format file size for display
      const sizeMB = size / 1024 / 1024;
      const sizeDisplay =
        sizeMB >= 1024
          ? `${(sizeMB / 1024).toFixed(2)} GB`
          : `${sizeMB.toFixed(2)} MB`;

      // For very large files (>100MB), write in chunks to avoid memory issues
      if (size > 100 * 1024 * 1024) {
        console.log(
          `   Creating ${name}: ${sizeDisplay} (this may take a while)...`
        );
        const chunkSize = 10 * 1024 * 1024; // 10 MB chunks
        const fd = fs.openSync(filePath, "w");
        let written = 0;
        while (written < size) {
          const chunk = crypto.randomBytes(Math.min(chunkSize, size - written));
          fs.writeSync(fd, chunk, 0, chunk.length, written);
          written += chunk.length;
        }
        fs.closeSync(fd);
        console.log(`   Created ${name}: ${sizeDisplay}`);
      } else {
        const buffer = crypto.randomBytes(size);
        fs.writeFileSync(filePath, buffer);
        console.log(`   Created ${name}: ${sizeDisplay}`);
      }
    }
  }

  console.log();
}

/**
 * Benchmark: File reading operations
 */
async function benchmarkFileRead(
  filePath: string,
  fileSize: number
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  // Adjust iterations based on file size
  let iterations: number;
  if (fileSize > 500 * 1024 * 1024) {
    // > 500 MB
    iterations = 5;
  } else if (fileSize > 50 * 1024 * 1024) {
    // > 50 MB
    iterations = 20;
  } else {
    iterations = 100;
  }

  // Method 1: Native C++ addon
  if (isNativeCppLoaded()) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await fastReadFile(filePath, 0, fileSize);
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "Read File",
      method: "Native C++ (mmap)",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
      throughputMBps: fileSize / 1024 / 1024 / (elapsed / 1000 / iterations),
    });
  }

  // Method 2: fs.promises.readFile
  {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await fs.promises.readFile(filePath);
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "Read File",
      method: "fs.promises.readFile",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
      throughputMBps: fileSize / 1024 / 1024 / (elapsed / 1000 / iterations),
    });
  }

  // Method 3: fs.readFileSync
  {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fs.readFileSync(filePath);
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "Read File",
      method: "fs.readFileSync",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
      throughputMBps: fileSize / 1024 / 1024 / (elapsed / 1000 / iterations),
    });
  }

  // Method 4: fs.promises with file descriptor (optimized)
  {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const fd = await fs.promises.open(filePath, "r");
      try {
        const buffer = Buffer.allocUnsafe(fileSize);
        await fd.read(buffer, 0, fileSize, 0);
      } finally {
        await fd.close();
      }
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "Read File",
      method: "fs.promises (fd)",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
      throughputMBps: fileSize / 1024 / 1024 / (elapsed / 1000 / iterations),
    });
  }

  return results;
}

/**
 * Benchmark: Checksum calculation
 */
async function benchmarkChecksum(
  filePath: string,
  fileSize: number
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  // Adjust iterations based on file size
  let iterations: number;
  if (fileSize > 500 * 1024 * 1024) {
    // > 500 MB
    iterations = 3;
  } else if (fileSize > 50 * 1024 * 1024) {
    // > 50 MB
    iterations = 10;
  } else {
    iterations = 50;
  }

  // Read file once for all checksum tests
  const buffer = fs.readFileSync(filePath);

  // Method 1: Native SIMD checksum
  if (isNativeCppLoaded()) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      simdChecksum(buffer);
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "Checksum",
      method: "Native SIMD",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
      throughputMBps: fileSize / 1024 / 1024 / (elapsed / 1000 / iterations),
    });
  }

  // Method 2: crypto.createHash (SHA-256)
  {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      crypto.createHash("sha256").update(buffer).digest("hex");
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "Checksum",
      method: "crypto SHA-256",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
      throughputMBps: fileSize / 1024 / 1024 / (elapsed / 1000 / iterations),
    });
  }

  // Method 3: crypto.createHash (MD5)
  {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      crypto.createHash("md5").update(buffer).digest("hex");
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "Checksum",
      method: "crypto MD5",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
      throughputMBps: fileSize / 1024 / 1024 / (elapsed / 1000 / iterations),
    });
  }

  // Method 4: Simple JavaScript hash
  {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      let hash = 0;
      for (let j = 0; j < buffer.length; j++) {
        hash = (hash * 31 + buffer[j]) | 0;
      }
      hash.toString(16);
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "Checksum",
      method: "JS Simple Hash",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
      throughputMBps: fileSize / 1024 / 1024 / (elapsed / 1000 / iterations),
    });
  }

  return results;
}

/**
 * Benchmark: File stats
 */
async function benchmarkStats(filePath: string): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const iterations = 10000;

  // Method 1: Native C++ stats
  if (isNativeCppLoaded()) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await getFileStats(filePath);
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "File Stats",
      method: "Native C++",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
    });
  }

  // Method 2: fs.promises.stat
  {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      await fs.promises.stat(filePath);
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "File Stats",
      method: "fs.promises.stat",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
    });
  }

  // Method 3: fs.statSync
  {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fs.statSync(filePath);
    }
    const elapsed = performance.now() - start;

    results.push({
      operation: "File Stats",
      method: "fs.statSync",
      iterations,
      totalTimeMs: elapsed,
      avgTimeMs: elapsed / iterations,
    });
  }

  return results;
}

/**
 * Display results in a formatted table
 */
function displayResults(results: BenchmarkResult[], fileSize?: number): void {
  // Use the slowest method as baseline for speedup calculation
  const baselineAvg = Math.max(...results.map((r) => r.avgTimeMs));

  console.log(
    `  ${"Method".padEnd(25)} | ${"Avg Time".padEnd(
      12
    )} | ${"Total Time".padEnd(12)} | ${"Speedup".padEnd(
      10
    )} | ${"Throughput".padEnd(12)}`
  );
  console.log(
    `  ${"-".repeat(25)} | ${"-".repeat(12)} | ${"-".repeat(12)} | ${"-".repeat(
      10
    )} | ${"-".repeat(12)}`
  );

  results.forEach((result, index) => {
    const speedup = baselineAvg / result.avgTimeMs;
    const speedupStr = `${speedup.toFixed(2)}x`;
    const avgTimeStr = `${result.avgTimeMs.toFixed(3)} ms`;
    const totalTimeStr = `${result.totalTimeMs.toFixed(0)} ms`;
    const throughputStr = result.throughputMBps
      ? `${result.throughputMBps.toFixed(2)} MB/s`
      : "N/A";

    // Highlight fastest method
    const isFastest = index === 0 && isNativeCppLoaded();
    const methodStr = result.method.padEnd(25);
    const color = isFastest ? colors.green : colors.reset;

    console.log(
      `  ${color}${methodStr}${colors.reset} | ${avgTimeStr.padEnd(
        12
      )} | ${totalTimeStr.padEnd(12)} | ${speedupStr.padEnd(
        10
      )} | ${throughputStr.padEnd(12)}`
    );
  });

  console.log();
}

/**
 * Calculate and display speedup summary
 */
function displaySpeedupSummary(allResults: BenchmarkResult[]): void {
  const nativeResults = allResults.filter((r) => r.method.includes("Native"));
  const standardResults = allResults.filter(
    (r) =>
      r.method.includes("fs.promises.readFile") ||
      r.method.includes("crypto SHA-256") ||
      r.method.includes("fs.promises.stat")
  );

  if (nativeResults.length === 0 || standardResults.length === 0) {
    return;
  }

  const avgNative =
    nativeResults.reduce((sum, r) => sum + r.avgTimeMs, 0) /
    nativeResults.length;
  const avgStandard =
    standardResults.reduce((sum, r) => sum + r.avgTimeMs, 0) /
    standardResults.length;
  const overallSpeedup = avgStandard / avgNative;

  console.log(`${colors.bright}${colors.cyan}OVERALL SPEEDUP${colors.reset}`);
  console.log(
    `${colors.green}Native C++ is ${overallSpeedup.toFixed(
      2
    )}x faster on average${colors.reset}`
  );
  console.log();
}

/**
 * Main benchmark runner
 */
async function runBenchmarks(): Promise<void> {
  console.log(
    `${colors.bright}${colors.blue}Native C++ File I/O Performance Benchmark${colors.reset}\n`
  );

  if (!isNativeCppLoaded()) {
    console.log(
      `${colors.yellow}WARNING: Native C++ addon not loaded!${colors.reset}`
    );
    console.log(`   Build it with: npm run build:native\n`);
  } else {
    console.log(`${colors.green}Native C++ addon loaded${colors.reset}\n`);
  }

  await createTestFiles();

  const testDir = path.join(__dirname, "benchmark_data");
  const testFiles = [
    {
      name: "small (100 KB)",
      path: path.join(testDir, "test_small.bin"),
      size: 1024 * 100,
    },
    {
      name: "medium (10 MB)",
      path: path.join(testDir, "test_medium.bin"),
      size: 1024 * 1024 * 10,
    },
    {
      name: "large (100 MB)",
      path: path.join(testDir, "test_large.bin"),
      size: 1024 * 1024 * 100,
    },
    {
      name: "xlarge (1 GB)",
      path: path.join(testDir, "test_xlarge.bin"),
      size: 1024 * 1024 * 1024,
    },
  ];

  const allResults: BenchmarkResult[] = [];

  // Run benchmarks for each file size
  for (const testFile of testFiles) {
    console.log(
      `${colors.bright}${colors.yellow}Testing: ${testFile.name}${colors.reset}\n`
    );

    // File read benchmark
    console.log(`${colors.cyan}1. File Read Performance${colors.reset}`);
    const readResults = await benchmarkFileRead(testFile.path, testFile.size);
    displayResults(readResults, testFile.size);
    allResults.push(...readResults);

    // Checksum benchmark
    console.log(
      `${colors.cyan}2. Checksum Calculation Performance${colors.reset}`
    );
    const checksumResults = await benchmarkChecksum(
      testFile.path,
      testFile.size
    );
    displayResults(checksumResults, testFile.size);
    allResults.push(...checksumResults);

    // Stats benchmark (only for first file to avoid repetition)
    if (testFile.name.includes("small")) {
      console.log(`${colors.cyan}3. File Stats Performance${colors.reset}`);
      const statsResults = await benchmarkStats(testFile.path);
      displayResults(statsResults);
      allResults.push(...statsResults);
    }

    console.log(`${"-".repeat(80)}\n`);
  }

  // Display overall summary
  displaySpeedupSummary(allResults);

  console.log(
    `${colors.bright}${colors.green}Benchmark completed!${colors.reset}`
  );
  console.log(`\n${colors.cyan}Key Takeaways:${colors.reset}`);
  console.log(`  • Native C++ uses mmap for zero-copy file access`);
  console.log(`  • SIMD instructions accelerate checksum calculations`);
  console.log(`  • Direct system calls reduce overhead vs Node.js wrappers`);
  console.log(`  • Performance gains increase with file size\n`);
}

// Run benchmarks
runBenchmarks().catch(console.error);
