"""AWS S3 storage utilities for file uploads."""
import os
import uuid
import boto3
import logging
from pathlib import Path
from dotenv import load_dotenv
from botocore.config import Config

load_dotenv(Path(__file__).parent / '.env')

logger = logging.getLogger(__name__)

AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "aiproducate")
APP_NAME = "aiproducate"

_s3_client = None

def get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
            config=Config(signature_version='s3v4')
        )
    return _s3_client

def put_object(path: str, data: bytes, content_type: str) -> dict:
    client = get_s3_client()
    client.put_object(
        Bucket=S3_BUCKET, Key=path, Body=data, ContentType=content_type
    )
    size = len(data)
    logger.info(f"Uploaded to S3: {path} ({size} bytes)")
    return {"path": path, "size": size, "bucket": S3_BUCKET}

def get_object(path: str):
    client = get_s3_client()
    response = client.get_object(Bucket=S3_BUCKET, Key=path)
    data = response['Body'].read()
    content_type = response.get('ContentType', 'application/octet-stream')
    return data, content_type

def generate_presigned_url(path: str, expiration: int = 3600) -> str:
    client = get_s3_client()
    url = client.generate_presigned_url(
        'get_object',
        Params={'Bucket': S3_BUCKET, 'Key': path},
        ExpiresIn=expiration
    )
    return url

def generate_upload_url(path: str, content_type: str = 'application/octet-stream', expiration: int = 3600) -> str:
    client = get_s3_client()
    url = client.generate_presigned_url(
        'put_object',
        Params={'Bucket': S3_BUCKET, 'Key': path, 'ContentType': content_type},
        ExpiresIn=expiration
    )
    return url

def generate_upload_path(user_id: str, filename: str) -> str:
    ext = filename.split(".")[-1] if "." in filename else "bin"
    return f"{APP_NAME}/uploads/{user_id}/{uuid.uuid4()}.{ext}"

def delete_object(path: str):
    client = get_s3_client()
    client.delete_object(Bucket=S3_BUCKET, Key=path)
    logger.info(f"Deleted from S3: {path}")
