
import sys
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# Setup path
sys.path.append("/media/ubuntu/4TB-HDD/ziyue/filetree")
load_dotenv("/media/ubuntu/4TB-HDD/ziyue/filetree/.env")

from backend.services.r2_service import r2_service
from backend.config import settings

def test_quota_tracking():
    print("--- Testing R2 Quota Tracking ---")
    
    # Check if usage file exists or was created
    usage_file = settings.paths.upload_folder.parent / "r2_usage.json"
    print(f"Usage File: {usage_file}")
    
    if not usage_file.exists():
        print("Usage file not found yet (expected if no ops ran).")
    else:
        with open(usage_file, 'r') as f:
            print(f"Current Usage: {f.read()}")

    # Simulate quota check
    print("\n[Test 1] Check Quota (Should be True)")
    if r2_service.acquire_upload_slot():
        print("✅ Acquired upload slot (Quota OK)")
        r2_service.release_upload_slot()
    else:
        print("❌ Failed to acquire slot (Quota Full?)")

    # Manually inspect usage again to see if it incremented
    # Note: acquire_upload_slot calls _check_quota(class_a=1) but NOT _increment_usage
    # Increment happens in create_multipart_upload etc.
    
    print("\n[Test 2] Simulate Usage Increment")
    # We call a private method for testing purposes only
    initial_usage = r2_service._usage.copy()
    print(f"Initial: {initial_usage}")
    
    r2_service._increment_usage(class_a=10, bytes_added=1024)
    print(f"Updated: {r2_service._usage}")
    
    assert r2_service._usage["requests_class_a"] == initial_usage["requests_class_a"] + 10
    assert r2_service._usage["storage_bytes_approx"] == initial_usage["storage_bytes_approx"] + 1024
    print("✅ Usage incremented correctly")

    # Revert changes to not mess up actual tracking too much (optional, but good for testing)
    r2_service._increment_usage(class_a=-10, bytes_added=-1024)
    print("Reverted test usage.")

if __name__ == "__main__":
    test_quota_tracking()
