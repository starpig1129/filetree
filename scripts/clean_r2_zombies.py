
import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Load env from root
load_dotenv("/media/ubuntu/4TB-HDD/ziyue/filetree/.env")

def clean_incomplete_uploads():
    endpoint = os.getenv("R2__ENDPOINT_URL")
    key_id = os.getenv("R2__ACCESS_KEY_ID")
    secret = os.getenv("R2__SECRET_ACCESS_KEY")
    bucket = os.getenv("R2__BUCKET_NAME")

    if not all([endpoint, key_id, secret, bucket]):
        print("❌ Missing R2 credentials in .env")
        return

    print(f"Connecting to R2 Bucket: {bucket}...")
    
    try:
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint,
            aws_access_key_id=key_id,
            aws_secret_access_key=secret
        )

        print("Searching for incomplete multipart uploads (zombies)...")
        
        # List incomplete uploads
        response = s3.list_multipart_uploads(Bucket=bucket)
        uploads = response.get('Uploads', [])
        
        if not uploads:
            print("✅ No incomplete uploads found. Your bucket is clean!")
            return

        print(f"⚠️ Found {len(uploads)} incomplete uploads. Cleaning up...")
        
        count = 0
        deleted_size_acc = 0 # Cannot easily know size without listing parts, just counting items
        
        for upload in uploads:
            key = upload['Key']
            upload_id = upload['UploadId']
            initiated = upload['Initiated']
            
            print(f"[{count+1}] Aborting: {key} (Started: {initiated})")
            
            try:
                s3.abort_multipart_upload(
                    Bucket=bucket,
                    Key=key,
                    UploadId=upload_id
                )
                count += 1
            except ClientError as e:
                print(f"   ❌ Failed to abort {key}: {e}")

        print(f"\n🎉 Successfully cleaned up {count} incomplete uploads!")
        print("Note: The 'Average Storage' metric on Cloudflare dashboard typically updates every 24 hours, so it may not drop immediately.")

    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    clean_incomplete_uploads()
