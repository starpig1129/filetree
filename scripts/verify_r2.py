
import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Load env from root
load_dotenv("/media/ubuntu/4TB-HDD/ziyue/filetree/.env")

def test_r2():
    endpoint = os.getenv("R2__ENDPOINT_URL")
    key_id = os.getenv("R2__ACCESS_KEY_ID")
    secret = os.getenv("R2__SECRET_ACCESS_KEY")
    bucket = os.getenv("R2__BUCKET_NAME")

    print(f"Testing R2 Connection...")
    print(f"Endpoint: {endpoint}")
    print(f"Bucket: {bucket}")
    
    if not all([endpoint, key_id, secret, bucket]):
        print("❌ Missing R2 credentials in .env")
        return

    try:
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=secret
        )
        
        # 1. List Buckets
        print("1. Listing buckets... (Skipping strict check)")
        try:
            response = s3.list_buckets()
            buckets = [b['Name'] for b in response['Buckets']]
            if bucket in buckets:
                print(f"✅ Bucket '{bucket}' found.")
            else:
                print(f"⚠️ Bucket '{bucket}' NOT found in list (Token might be scoped). Proceeding...")
        except ClientError as e:
            print(f"⚠️ ListBuckets failed ({e}). Token might be scoped to single bucket. Proceeding to upload...")

        # 2. Upload Test File
        print("2. Uploading test file...")
        test_filename = "r2_test_verification.txt"
        with open(test_filename, "w") as f:
            f.write("Hello R2 from FileNexus verification script!")
            
        s3.upload_file(test_filename, bucket, f"temp/{test_filename}")
        print("✅ Upload successful.")
        
        # 3. Cleanup
        print("3. Deleting test file...")
        s3.delete_object(Bucket=bucket, Key=f"temp/{test_filename}")
        print("✅ Delete successful.")
        
        os.remove(test_filename)
        print("\n🎉 R2 Configuration is VALID!")
        
    except ClientError as e:
        print(f"\n❌ R2 Error: {e}")
    except Exception as e:
        print(f"\n❌ Unexpected Error: {e}")

if __name__ == "__main__":
    test_r2()
