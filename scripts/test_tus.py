import requests
import base64
import os

# Settings
BASE_URL = "http://localhost:5168/api/upload/tus"
FILE_CONTENT = b"Hello, this is a test file for Tus chunked upload verification! " * 1000
METADATA = "filename " + base64.b64encode(b"test_tus_file.txt").decode() + ",password " + base64.b64encode(b"testpass").decode()

def test_upload():
    print("Testing Tus upload...")
    
    # 1. Create upload
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": str(len(FILE_CONTENT)),
        "Upload-Metadata": METADATA
    }
    resp = requests.post(BASE_URL, headers=headers)
    if resp.status_code != 201:
        print(f"FAILED to create upload: {resp.status_code}")
        print(resp.text)
        return
    
    location = resp.headers.get("Location")
    print(f"Created upload at {location}")
    
    # 2. Upload in two chunks
    chunk1 = FILE_CONTENT[:1000]
    chunk2 = FILE_CONTENT[1000:]
    
    print("Uploading chunk 1...")
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream"
    }
    resp = requests.patch(location, data=chunk1, headers=headers)
    if resp.status_code != 200:
        print(f"FAILED to upload chunk 1: {resp.status_code}")
        return
    
    print("Uploading chunk 2...")
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "1000",
        "Content-Type": "application/offset+octet-stream"
    }
    resp = requests.patch(location, data=chunk2, headers=headers)
    if resp.status_code != 200:
        print(f"FAILED to upload chunk 2: {resp.status_code}")
        return
    
    print("Upload completed successfully!")

if __name__ == "__main__":
    test_upload()
