import boto3
import os
import sys
import requests
from botocore.client import Config

# Helper to load config from env or file would be complex, 
# let's try to import from backend if possible, or manual input.
# We will try to import backend.config
sys.path.append(os.getcwd())
try:
    from backend.config import settings
    from backend.services.r2_service import r2_service
except ImportError:
    print("Could not import backend config. Please run from project root.")
    sys.exit(1)

def test_r2_flow():
    print("--- Starting R2 Resumability Diagnostic ---")
    
    if not r2_service.is_configured():
        print("FAIL: R2 Service is not configured or client is None.")
        return
        
    print(f"Endpoint: {settings.r2.endpoint_url}")
    print(f"Bucket: {settings.r2.bucket_name}")
    
    # 1. Create Multipart Upload
    key = "debug/resume_test.txt"
    print(f"\n1. creating multipart upload for key: {key}")
    try:
        res = r2_service.create_multipart_upload(key)
        if not res:
            print("FAIL: create_multipart_upload returned None.")
            return
        upload_id = res['UploadId']
        print(f"SUCCESS: UploadId: {upload_id}")
    except Exception as e:
        print(f"FAIL: Exception: {e}")
        return

    # 2. Upload a Part (Part 1)
    print("\n2. Uploading Part 1 (via presigned url)...")
    try:
        # Generate URL
        url = r2_service._client.generate_presigned_url(
            ClientMethod='upload_part',
            Params={
                'Bucket': settings.r2.bucket_name,
                'Key': key,
                'UploadId': upload_id,
                'PartNumber': 1
            },
            ExpiresIn=3600
        )
        # Upload dummy data
        data = b"Hello R2 Resume World"
        put_res = requests.put(url, data=data)
        if put_res.status_code != 200:
            print(f"FAIL: Put Part 1 failed with {put_res.status_code}")
            print(put_res.text)
            # Cleanup
            r2_service._client.abort_multipart_upload(Bucket=settings.r2.bucket_name, Key=key, UploadId=upload_id)
            return
        
        # We must collect ETag for completion usually, but here we just want to list it.
        etag = put_res.headers.get('ETag')
        print(f"SUCCESS: Part 1 uploaded. ETag: {etag}")
    except Exception as e:
        print(f"FAIL: Upload Part Exception: {e}")
        r2_service._client.abort_multipart_upload(Bucket=settings.r2.bucket_name, Key=key, UploadId=upload_id)
        return

    # 3. List Parts (The Core Fix Verification)
    print("\n3. Testing list_parts...")
    try:
        parts = r2_service.list_parts(upload_id, key)
        print(f"Response from list_parts (raw): {parts}")
        
        # Simulate API response serialization
        import json
        try:
            # We need to manually simulate the sanitization logic here to verify it works 
            # OR we can just check if raw parts *would* fail (confirming the bug existed)
            # and rely on the actual API test to verify the fix.
            # But let's verify if our fix logic IN THE API matches what we expect here.
            
            # The API does:
            sanitized_parts = []
            for p in parts:
                sanitized_parts.append({
                    "PartNumber": p.get("PartNumber"),
                    "Size": p.get("Size"),
                    "ETag": p.get("ETag") 
                })
            json_output = json.dumps(sanitized_parts)
            print("SUCCESS: JSON serialization check passed (simulated API logic).")
        except TypeError as e:
            print(f"FAIL: JSON serialization check failed: {e}")

        found = False
        for p in parts:
            if p['PartNumber'] == 1:
                found = True
                
        if found:
            print("SUCCESS: list_parts correctly identified the uploaded part.")
        else:
            print("FAIL: list_parts did NOT find the uploaded part.")
            
    except Exception as e:
        print(f"FAIL: list_parts Exception: {e}")

    # 4. Cleanup
    print("\n4. Cleaning up (Aborting upload)...")
    try:
        r2_service._client.abort_multipart_upload(Bucket=settings.r2.bucket_name, Key=key, UploadId=upload_id)
        print("SUCCESS: Upload aborted.")
    except Exception as e:
        print(f"WARNING: Cleanup failed: {e}")

if __name__ == "__main__":
    test_r2_flow()
