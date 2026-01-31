
from backend.config import settings
import os

print(f"Current Working Directory: {os.getcwd()}")
print(f".env exists: {os.path.exists('.env')}")
if os.path.exists('.env'):
    with open('.env') as f:
        print(f".env content:\n{f.read()}")

print(f"Loaded Master Key: {settings.security.master_key}")
print(f"YAML Master Key (should be): CHANGE_ME_IN_PRODUCTION")

if settings.security.master_key == "pigstar":
    print("SUCCESS: Master key overridden by .env")
else:
    print("FAILURE: Master key NOT overridden")
