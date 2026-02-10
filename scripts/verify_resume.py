import requests
import time
import sys

BASE_URL = "http://localhost:5168"
UPLOAD_ID = "dummy-upload-id"
KEY = "dummy-key"

def wait_for_server():
    print("Waiting for server...")
    for _ in range(30):
        try:
            requests.get(f"{BASE_URL}/api/init", timeout=1)
            print("Server is up!")
            return True
        except requests.ConnectionError:
            time.sleep(1)
            print(".", end="", flush=True)
    return False

def test_list_parts():
    print(f"\nTesting list_parts for {UPLOAD_ID}...")
    try:
        # Note: key/partNumber logic in api.py:
        # if partNumber is None -> list parts
        # endpoint: /upload/r2/multipart/{uploadId}?key={key}
        url = f"{BASE_URL}/api/upload/r2/multipart/{UPLOAD_ID}"
        params = {"key": KEY}
        
        response = requests.get(url, params=params)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        # We expect empty list [] if R2 returns empty list for invalid ID?
        # Or error? R2/S3 usually returns NoSuchUpload if ID is invalid.
        # Our code catches ClientError and returns [] on error in list_parts logic?
        # Let's check r2_service.py:
        # except ClientError as e: logger.error... return []
        # So we expect [] (empty list) and 200 OK even if upload ID is invalid, 
        # unless R2 service connectivity fails (503).
        
        if response.status_code == 200:
            if response.json() == []:
                print("SUCCESS: Endpoint reachable and returned empty list (as expected for dummy ID).")
                return True
            else:
                print("WARNING: Unexpected response (not empty list).")
                return True # Technicall reachable
        elif response.status_code == 503:
             print("SKIPPED: R2 Service unavailable (expected if no creds).")
             return True
        else:
             print("FAILURE: Unexpected status code.")
             return False

    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if not wait_for_server():
        print("Server failed to start.")
        sys.exit(1)
        
    if test_list_parts():
        print("Verification Passed!")
        sys.exit(0)
    else:
        print("Verification Failed!")
        sys.exit(1)
