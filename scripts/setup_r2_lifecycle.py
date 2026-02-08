
import sys
import os
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Setup path
sys.path.append("/media/ubuntu/4TB-HDD/ziyue/filetree")
load_dotenv("/media/ubuntu/4TB-HDD/ziyue/filetree/.env")

from backend.config import settings

def setup_lifecycle():
    print("=== 🛡️ R2 Lifecycle Safety Setup ===")
    
    if not settings.r2.endpoint_url or not settings.r2.access_key_id:
        print("❌ R2 credentials missing.")
        return

    try:
        client = boto3.client(
            's3',
            endpoint_url=settings.r2.endpoint_url,
            aws_access_key_id=settings.r2.access_key_id,
            aws_secret_access_key=settings.r2.secret_access_key,
            config=Config(signature_version='s3v4'),
            region_name='auto'
        )
        
        bucket_name = settings.r2.bucket_name
        print(f"Target Bucket: {bucket_name}")

        # 1. Check existing rules
        print("\n[Step 1] Checking existing lifecycle rules...")
        try:
            current = client.get_bucket_lifecycle_configuration(Bucket=bucket_name)
            print("Current Rules:")
            for rule in current.get('Rules', []):
                print(f" - ID: {rule.get('ID')} | Status: {rule.get('Status')} | Expiration: {rule.get('Expiration')}")
        except ClientError as e:
            if "NoSuchLifecycleConfiguration" in str(e):
                print(" -> No lifecycle rules found.")
            else:
                print(f" -> Error reading rules: {e}")

        # 2. Apply strict 1-day deletion rule
        print("\n[Step 2] Applying 'Zero-Cost Safety' Rule (Delete after 1 day)...")
        
        lifecycle_config = {
            'Rules': [
                {
                    'ID': 'ZeroCostSafety_AutoDelete',
                    'Status': 'Enabled',
                    'Prefix': '', # Apply to ALL files
                    'Expiration': {
                        'Days': 1 # Hard limit: 1 day
                    },
                    'AbortIncompleteMultipartUpload': {
                        'DaysAfterInitiation': 1 # Clean incomplete parts too
                    }
                }
            ]
        }
        
        client.put_bucket_lifecycle_configuration(
            Bucket=bucket_name,
            LifecycleConfiguration=lifecycle_config
        )
        
        print("✅ Rule Applied Successfully!")
        print("   - All files will be auto-deleted by Cloudflare after 24 hours.")
        print("   - Incomplete uploads will be auto-aborted after 24 hours.")
        print("   - This works even if your backend server is offline.")

    except Exception as e:
        print(f"❌ Critical Error: {e}")

if __name__ == "__main__":
    setup_lifecycle()
