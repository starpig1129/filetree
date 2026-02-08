
import sys
import os
import json
import time
from pathlib import Path
from dotenv import load_dotenv

# Setup path
sys.path.append("/media/ubuntu/4TB-HDD/ziyue/filetree")
load_dotenv("/media/ubuntu/4TB-HDD/ziyue/filetree/.env")

from backend.config import settings

def check_status():
    print("=== 📊 FileNexus R2 Usage Report ===")
    
    usage_file = settings.paths.upload_folder.parent / "r2_usage.json"
    
    # Defaults
    usage = {
        "month": time.strftime("%Y-%m"),
        "storage_bytes_approx": 0,
        "requests_class_a": 0,
        "requests_class_b": 0
    }

    if usage_file.exists():
        try:
            with open(usage_file, 'r') as f:
                usage = json.load(f)
        except Exception as e:
            print(f"⚠️ Error reading usage file: {e}")

    # Limits
    limit_gb = settings.r2.monthly_limit_gb
    limit_a = settings.r2.monthly_limit_class_a
    limit_b = settings.r2.monthly_limit_class_b
    
    # Calculate %
    used_a = usage["requests_class_a"]
    pct_a = (used_a / limit_a) * 100
    
    used_b = usage["requests_class_b"]
    pct_b = (used_b / limit_b) * 100

    print(f"\n📅 Period: {usage['month']}")
    print("-" * 40)
    
    print(f"\n1️⃣  Class A Operations (Upload/Delete)")
    print(f"   Used:      {used_a:,}")
    print(f"   Limit:     {limit_a:,} (Free Tier: 1M)")
    print(f"   Remaining: {limit_a - used_a:,}")
    print(f"   Status:    [{'#' * int(pct_a/10)}{'-' * (10 - int(pct_a/10))}] {pct_a:.1f}%")

    print(f"\n2️⃣  Class B Operations (Download)")
    print(f"   Used:      {used_b:,}")
    print(f"   Limit:     {limit_b:,} (Free Tier: 10M)")
    print(f"   Remaining: {limit_b - used_b:,}")
    print(f"   Status:    [{'#' * int(pct_b/10)}{'-' * (10 - int(pct_b/10))}] {pct_b:.1f}%")

    print(f"\n3️⃣  Transient Storage Flow (Informational)")
    print(f"   Total Bytes Passed Through: {usage['storage_bytes_approx'] / (1024*1024*1024):.2f} GB")
    print(f"   Note: This is cumulative flow. Since files are auto-deleted,")
    print(f"         your actual billable storage is near 0 GB.")

    print("-" * 40)
    if pct_a >= 100 or pct_b >= 100:
        print("❌ QUOTA EXCEEDED - R2 is disabled. High-speed upload unavailable.")
    else:
        print("✅ QUOTA OK - High-speed upload active.")

if __name__ == "__main__":
    check_status()
