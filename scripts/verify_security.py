
import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = "http://localhost:5168/api"
MASTER_KEY = os.environ.get("SECURITY__MASTER_KEY", "pigstar")

def test_path_traversal():
    print("Testing Path Traversal...")
    
    # Test 1: Route parameter traversal (should fail routing or be sanitized)
    # We attempt to access /etc/passwd
    target = "%2e%2e%2f" * 8 + "etc%2fpasswd"
    url = f"{BASE_URL}/download/starpig/{target}"
    print(f"URL: {url}")
    response = requests.get(url)
    print(f"GET Response: {response.status_code}")

    is_spa_fallback = False
    if response.status_code == 200 and "<!doctype html>" in response.text.lower():
        is_spa_fallback = True
        print("INFO: Request fell back to SPA (index.html). This means API route didn't match.")

    if response.status_code in [404, 400, 422, 403, 401]:
         print("PASS: Path traversal via URL path blocked/not found.")
    elif is_spa_fallback:
         print("PASS: Path traversal blocked (fell back to frontend).")
    else:
         # Check for actual vulnerability
         if "root:x:0:0" in response.text:
             print("CRITICAL: Path Traversal Vulnerability Confirmed!")
         else:
             print(f"WARN: Unexpected response {response.status_code}. Content might be safe but unexpected.")

    # Test 2: Form parameter traversal (should be blocked by auth or sanitized)
    # POST /user/{username}/delete
    url = f"{BASE_URL}/user/starpig/delete"
    data = {"filename": "../../../etc/passwd"}
    response = requests.post(url, data=data)
    print(f"POST Response: {response.status_code}")

    if response.status_code == 401:
        print("PASS: Unauthenticated deletion blocked (401).")
    elif response.status_code == 404:
        print("PASS: Deletion returned 404 (likely sanitized and file not found).")
    else:
        print(f"WARN: Unexpected response {response.status_code}")

def test_admin_auth():
    print("\nTesting Admin Auth...")
    # Test with wrong key
    response = requests.get(f"{BASE_URL}/admin/verify?master_key=wrong")
    print(f"Wrong key response: {response.status_code}")
    
    # Test with correct key
    response = requests.get(f"{BASE_URL}/admin/verify?master_key={MASTER_KEY}")
    print(f"Correct key response: {response.status_code}")
    
    if response.status_code == 200:
        print("PASS: Admin auth is working with config key.")
    else:
        print("FAIL: Admin auth failed with correct key.")

if __name__ == "__main__":
    try:
        test_path_traversal()
        test_admin_auth()
    except Exception as e:
        print(f"Test error: {e}")
