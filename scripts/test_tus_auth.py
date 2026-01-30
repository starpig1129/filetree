import requests
import base64
import os

# Settings
BASE_URL = "http://localhost:5168/api/upload/tus"

# Test 1: Invalid Password
def test_invalid_password():
    print("Testing Invalid Password...")
    metadata = "filename " + base64.b64encode(b"test_invalid.txt").decode() + ",password " + base64.b64encode(b"wrongpass").decode()
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": "100",
        "Upload-Metadata": metadata
    }
    resp = requests.post(BASE_URL, headers=headers)
    if resp.status_code == 401:
        print("[PASS] Successfully rejected invalid password (401)")
    else:
        print(f"[FAIL] Expected 401, got {resp.status_code}")
        print(resp.text)

# Test 2: Valid Password
def test_valid_password():
    print("\nTesting Valid Password...")
    metadata = "filename " + base64.b64encode(b"test_valid.txt").decode() + ",password " + base64.b64encode(b"testpass").decode()
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": "100",
        "Upload-Metadata": metadata
    }
    resp = requests.post(BASE_URL, headers=headers)
    if resp.status_code == 201:
        print(f"[PASS] Successfully created upload (201). Location: {resp.headers.get('Location')}")
    else:
        print(f"[FAIL] Expected 201, got {resp.status_code}")
        print(resp.text)

if __name__ == "__main__":
    try:
        test_invalid_password()
        test_valid_password()
    except Exception as e:
        print(f"Error: {e}")
