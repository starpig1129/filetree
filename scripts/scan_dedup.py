#!/usr/bin/env python3
"""
CLI script to scan and deduplicate existing files.
Usage: python scripts/scan_dedup.py
"""

import asyncio
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.dedup_service import dedup_service

async def main():
    print("=" * 50)
    print("File Deduplication Scanner")
    print("=" * 50)
    
    stats = await dedup_service.scan_existing_files()
    
    print("\n" + "=" * 50)
    print("Summary:")
    print(f"  Files scanned:     {stats['scanned']}")
    print(f"  Files deduplicated: {stats['deduplicated']}")
    print(f"  Space saved:       {stats['space_saved_bytes'] / (1024*1024):.2f} MB")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(main())
