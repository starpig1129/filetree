
import os
from backend.services.file_service import file_service
import asyncio

async def test():
    print('Testing os.path.basename...')
    print('Sanitized ../../../etc/passwd ->', os.path.basename('../../../etc/passwd'))
    
    print('\nTesting file_service folder creation...')
    # This shouldn't be affected by my change but good to check
    folder = file_service._get_user_folder('test_user')
    print('Service folder for test_user:', folder)

if __name__ == "__main__":
    asyncio.run(test())
