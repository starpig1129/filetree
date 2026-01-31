
import requests
import os

BASE_URL = "http://localhost:5168/api"
MASTER_KEY = "pigstar" # Default in config.py for now

def test_path_traversal():
    print("Testing Path Traversal...")
    # Attempt to delete /etc/passwd (should fail or at least not target the actual file)
    # The backend should sanitize it to 'passwd' and look in the user folder
    target = "../../../../../../../../../etc/passwd"
    response = requests.delete(f"{BASE_URL}/files/starpig/{target}")
    print(f"Delete attempt response: {response.status_code} - {response.text}")
    
    if "passwd" in response.text and response.status_code == 404:
        print("PASS: Path traversal attempt was sanitized and failed correctly.")
    else:
        print("FAIL: Path traversal might be vulnerable or returned unexpected result.")

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
