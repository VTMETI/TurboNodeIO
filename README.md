# **TurboNodeIO**

![Status](https://img.shields.io/badge/status-PoC-orange.svg)
![Performance](https://img.shields.io/badge/performance-18.95x%20faster-brightgreen.svg)
![Native](https://img.shields.io/badge/native-C%2B%2B-blue.svg)
![Node](https://img.shields.io/badge/node-addon-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![OS](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)

High-performance **Native C++ acceleration for Node.js File I/O and SIMD operations**.
This project is a **Proof of Concept (PoC)** demonstrating how much performance can be gained by moving critical workloads from JavaScript to **native C++ addons**.

TurboNodeIO benchmarks show significant improvements in **file reading throughput**, **checksum calculations**, and **repeated I/O operations**.

---

## **Performance Results (Windows)**

| Operation             | Native C++ | Standard TS          | Speedup         |
| --------------------- | ---------- | -------------------- | --------------- |
| File Read (1GB)       | 9.367 ms   | 530.283 ms (sync)    | **56x faster**  |
| File Read (100MB)     | 0.179 ms   | 56.796 ms (readFile) | **317x faster** |
| File Read (10MB)      | 0.132 ms   | 4.465 ms (readFile)  | **34x faster**  |
| File Read (100KB)     | 0.070 ms   | 0.314 ms (fd)        | **4.5x faster** |
| SIMD Checksum (1GB)   | 50.086 ms  | 2245.118 ms (JS)     | **45x faster**  |
| SIMD Checksum (100MB) | 5.052 ms   | 136.048 ms (JS)      | **27x faster**  |
| SIMD Checksum (10MB)  | 0.503 ms   | 11.966 ms (MD5)      | **24x faster**  |
| SIMD Checksum (100KB) | 0.003 ms   | 0.200 ms (JS)        | **71x faster**  |
| File Stats            | 0.031 ms   | 0.027 ms (sync)      | Comparable      |

### **Overall Speedup**

Native C++ is **18.95x faster on average**

_Results measured on Windows hardware. Results vary depending on environment._

---

## **Setup**

### **Prerequisites**

- Node.js 16+
- Python 3 (for node-gyp)
- C++ toolchain:

  - **Windows**: Visual Studio Build Tools 2019+
  - **macOS**: Xcode Command Line Tools
  - **Linux**: GCC/G++ 7+

### **Install and build**

```powershell
npm install
npm run build:native
npm run benchmark
```

---

## **Running the Benchmark**

```powershell
npm run benchmark
```

The benchmark:

1. Generates test files (100KB, 10MB, 100MB, 1GB)
2. Compares 4 file-reading methods
3. Compares 4 checksum algorithms
4. Tests file stat operations
5. Outputs detailed speed and throughput results

Sample output is available in the repository.

---

## **Technical Details**

### **Native C++ Features**

1. **Memory-Mapped I/O (mmap)**

   - Zero-copy file access
   - OS-level caching
   - Minimal syscall overhead

2. **SIMD (AVX2)**

   - Processes 256 bits per instruction
   - Large-buffer checksum acceleration

3. **Direct system calls**

   - Bypasses Node.js abstraction layers
   - Lower overhead

### **Fallback Behavior**

If C++ addon build fails, TurboNodeIO uses optimized JavaScript implementations automatically.

---

## **Project Structure**

```
.
├── file_io.cc
├── index.ts
├── benchmark.ts
├── binding.gyp
├── package.json
├── tsconfig.json
└── README.md
```

---

## **Key Takeaways**

- Native addons are useful for **CPU-bound** or **high-throughput** workloads
- Performance benefits scale with larger inputs
- Overhead reduces gains on small files (<1MB)
- Development complexity trades for runtime speed

---

## **Customization**

Modify `benchmark.ts` to:

- Change tested file sizes
- Increase iteration counts
- Add new read or hashing algorithms
- Benchmark real workloads

---

## **Troubleshooting**

### Build failed

```powershell
node-gyp rebuild --verbose
```

### Permission problems

```powershell
icacls "m:\File_IO" /grant Users:F /t
```

---

## **License**

MIT

## **Contributing**

PRs and discussions are welcome.
