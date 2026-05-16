# Practical Hashing for Integrity Checks (Local-only)

Cryptographic hashing is fundamental to modern software development. From verifying file downloads to checking data integrity, understanding how hashes work helps developers build more reliable systems.

## What is a Cryptographic Hash?

A cryptographic hash function takes input of any size and produces a fixed-size output (the hash or digest). Key properties include:

- **Deterministic**: Same input always produces the same hash
- **One-way**: Cannot reverse the hash to get the original input
- **Collision-resistant**: Hard to find two inputs with the same hash
- **Avalanche effect**: Small input changes create dramatically different hashes

## Common Hash Algorithms

### SHA-256
Part of the SHA-2 family, SHA-256 produces a 256-bit (64 character hex) hash. It's widely used for:
- File integrity verification
- Digital signatures
- Blockchain and cryptocurrency
- General-purpose hashing

### SHA-512
Also in the SHA-2 family, SHA-512 produces a 512-bit (128 character hex) hash. It offers:
- Larger hash space
- Better performance on 64-bit systems
- Higher security margin

Both algorithms are available in our [Hash Generator tool](/tools/hash-generator), which uses the Web Crypto API for reliable, browser-native processing.

## Practical Use Cases

### File Integrity Verification
When downloading software, compare the file's hash against the published hash to ensure the file wasn't corrupted or tampered with during transfer.

### Data Deduplication
Hashes can identify duplicate content without comparing full files. Store the hash of each file and check new files against existing hashes.

### Change Detection
Generate hashes of configuration files or datasets. When the hash changes, you know the content changed, even if timestamps were preserved.

### Cache Invalidation
Use content hashes in filenames or cache keys. When content changes, the hash changes, automatically invalidating old cached versions.

## Using Browser-Based Hashing

Our tool uses the Web Crypto API, which provides:
- Native browser implementation
- Hardware acceleration where available
- No external dependencies
- Consistent results across platforms

All processing happens locally in your browser, making it safe for sensitive data.
