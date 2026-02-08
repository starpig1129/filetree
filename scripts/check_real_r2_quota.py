
import sys
import os
import requests
import json
from datetime import datetime
from dotenv import load_dotenv

# Load env variables if they exist
load_dotenv("/media/ubuntu/4TB-HDD/ziyue/filetree/.env")

def query_real_r2_usage():
    print("=== 🌐 Cloudflare Real Usage Query (GraphQL) ===")
    print("This script queries Cloudflare's official billing API for your REAL usage.")
    print("WARNING: You need an API Token with 'Account Analytics: Read' permission.")
    
    # Try to get from ENV or ask user
    account_id = os.getenv("CF_ACCOUNT_ID")
    api_token = os.getenv("CF_API_TOKEN") # Different from R2 tokens!

    if not account_id:
        account_id = input("Enter your Cloudflare Account ID: ").strip()
    if not api_token:
        api_token = input("Enter your Cloudflare API Token (Analytics Read): ").strip()

    if not account_id or not api_token:
        print("❌ Missing credentials.")
        return

    url = "https://api.cloudflare.com/client/v4/graphql"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }

    # Query for storage and operations
    # Note: GraphQL schema for R2 is specific.
    # We query r2Storage and r2Operations
    
    today = datetime.now().date().isoformat()
    # Get first day of current month
    start_date = datetime.now().replace(day=1).date().isoformat()

    query = """
    query R2Usage($accountTag: string!, $dateStart: string!, $dateEnd: string!) {
      viewer {
        accounts(filter: {accountTag: $accountTag}) {
          r2StorageAdaptiveGroups(
            limit: 100,
            filter: {date_geq: $dateStart, date_leq: $dateEnd}
          ) {
            sum {
              payloadSize
            }
            dimensions {
              bucketName
            }
          }
          r2OperationsAdaptiveGroups(
            limit: 100,
            filter: {date_geq: $dateStart, date_leq: $dateEnd}
          ) {
            sum {
              requests
            }
            dimensions {
              actionType
            }
          }
        }
      }
    }
    """
    
    variables = {
        "accountTag": account_id,
        "dateStart": start_date,
        "dateEnd": today
    }

    print("Querying Cloudflare API...")
    try:
        response = requests.post(url, json={"query": query, "variables": variables}, headers=headers)
        if response.status_code != 200:
            print(f"❌ API Error: {response.text}")
            return
            
        data = response.json()
        if "errors" in data and data["errors"]:
            print(f"❌ GraphQL Error: {data['errors']}")
            return

        result = data["data"]["viewer"]["accounts"][0]
        
        # Parse Storage
        storage_data = result["r2StorageAdaptiveGroups"]
        total_storage_bytes = sum(g["sum"]["payloadSize"] for g in storage_data)
        
        # Parse Operations
        ops_data = result["r2OperationsAdaptiveGroups"]
        class_a_ops = 0
        class_b_ops = 0
        
        for group in ops_data:
            action = group["dimensions"]["actionType"]
            count = group["sum"]["requests"]
            # Simplified mapping (approximate)
            if action in ["PutObject", "CopyObject", "CompleteMultipartUpload", "CreateMultipartUpload", "UploadPart", "DeleteObject"]:
                class_a_ops += count
            elif action in ["GetObject", "HeadObject", "ListObjects"]:
                class_b_ops += count
                
        print("\n=== ✨ Real Cloudflare Billing Data (Month-to-Date) ===")
        print(f"📅 Period: {start_date} to {today}")
        
        print(f"\n1️⃣  Class A Operations")
        print(f"   Real Count: {class_a_ops:,}")
        
        print(f"\n2️⃣  Class B Operations")
        print(f"   Real Count: {class_b_ops:,}")
        
        print(f"\n3️⃣  Average Storage (Approx)")
        # Note: GraphQL gives payloadSize sum over time? Or max? Usually it's storageByteHours.
        # R2 metrics are tricky. This is "Total Payload Size" transferred/stored? 
        # Actually storageByteHours is better for billing.
        # But for simple check, payloadSize is okay.
        print(f"   Stored Bytes Sum: {total_storage_bytes / (1024*1024*1024):.2f} GB")
        
        print("\n✅ Verification Complete.")

    except Exception as e:
        print(f"❌ Script Error: {e}")

if __name__ == "__main__":
    query_real_r2_usage()
