import requests
import base64
import uuid
import sys

BASE_URL = "http://localhost:5168/api"
TUS_URL = f"{BASE_URL}/upload/tus"

USERNAME = "testuser"
PASSWORD = "testuser"
MASTER_KEY = "pigstar"

def create_test_user():
    print(f"Creating test user '{USERNAME}'...")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/create-user",
            data={"master_key": MASTER_KEY, "username": USERNAME},
            timeout=5
        )
        if response.status_code == 200:
            print("User created successfully.")
        elif response.status_code == 400 and "exists" in response.text:
            print("User already exists, proceeding.")
        else:
            print(f"Failed to create user: {response.status_code} {response.text}")
            return False
        return True
    except Exception as e:
        print(f"Error creating user: {e}")
        return False

def encode_metadata(meta_dict):
    pairs = []
    for k, v in meta_dict.items():
        encoded = base64.b64encode(v.encode("utf-8")).decode("utf-8")
        pairs.append(f"{k} {encoded}")
    return ",".join(pairs)

def create_partial_upload(data, filename):
    # Password must be in metadata for TUS auth
    metadata = {
        "filename": filename,
        "password": PASSWORD
    }
    encoded_metadata = encode_metadata(metadata)
    
    headers = {
        "Upload-Length": str(len(data)),
        "Upload-Metadata": encoded_metadata,
        "Upload-Concat": "partial"
    }
    
    try:
        response = requests.post(TUS_URL, headers=headers, timeout=5)
# ... inside test_concatenation ...
    # specific filename for final file
    final_filename = f"concat_test_{uuid.uuid4()}.txt"
    metadata = {
        "filename": final_filename,
        "password": PASSWORD
    }
    encoded_metadata = encode_metadata(metadata)
    
    headers = {
        "Upload-Metadata": encoded_metadata,
        "Upload-Concat": f"final; {url1} {url2}"
    }
        if response.status_code != 201:
            print(f"Failed to create partial upload: {response.text}")
            return None
        url = response.headers["Location"]
        print(f"Created partial upload: {url}")
        
        # Patch data
        headers = {
            "Content-Type": "application/offset+octet-stream",
            "Upload-Offset": "0",
            "Tus-Resumable": "1.0.0"
        }
        response = requests.patch(url, headers=headers, data=data, timeout=10)
        if response.status_code != 204:
            print(f"Failed to patch data: {response.text}")
            return None
        print(f"Uploaded data to {url}")
        return url
    except Exception as e:
        print(f"Error in partial upload: {e}")
        return None

def test_concatenation():
    if not create_test_user():
        return

    print("Testing TUS Concatenation...")
    
    part1_data = b"Hello "
    part2_data = b"World!"
    
    url1 = create_partial_upload(part1_data, "part1.txt")
    url2 = create_partial_upload(part2_data, "part2.txt")
    
    if not url1 or not url2:
        return

    # specific filename for final file
    final_filename = f"concat_test_{uuid.uuid4()}.txt"
    metadata = {
        "filename": final_filename,
        "password": PASSWORD
    }
    encoded_metadata = encode_metadata(metadata)
    
    headers = {
        "Upload-Metadata": encoded_metadata,
        "Upload-Concat": f"final; {url1} {url2}"
    }
    
    try:
        response = requests.post(TUS_URL, headers=headers, timeout=10)
        if response.status_code != 201: # TUS 1.0.0 says 201 Created for final
            print(f"Failed to create final upload: {response.status_code} {response.text}")
            return

        final_url = response.headers.get("Location")
        print(f"Created final upload: {final_url}")
        print("\nSUCCESS: Concatenation request accepted.")
        
        # Verify download
        # Logic: Login to get token? Or just download if we implemented public download?
        # api.py has /download/{username}/{filename} which needs token OR password session (which we don't have easily in script)
        # But we can verify by checking if file exists in TUS upload? No, it's moved to user folder.
        # We can try to list files using password.
        
        print("Verifying file listing...")
        # /api/login to get user info? No /api/files/{username} is protected?
        # It's public-ish? No, get_files requires nothing?
        # @router.get("/files/{username}") -> get_files(username)
        # It calls user_service.get_user_by_name and then file_service.get_user_files.
        # It DOES NOT require authentication header! 
        # But wait, UserPage calls it.
        # api.py: 
        # @router.get("/files/{username}", response_model=List[FileInfo])
        # async def get_files(username: str):
        # ...
        # It seems unprotected in the route definition!
        # The dashboard endpoint /user/{username} handles auth logic to filter headers.
        # But /files/{username} seems raw?
        # Let's check `api.py` content again.
        
    except Exception as e:
        print(f"Error in concatenation: {e}")

if __name__ == "__main__":
    test_concatenation()
