#!/bin/bash
# CREATE SECRETS DIRECTORY WITH DUMMY VALUES
# This is required for docker-compose up to work

mkdir -p ./secrets

# Create dummy secrets (replace with real values in production)
echo "redis-REPLACE-WITH-REAL-PASSWORD" > ./secrets/redis_password.txt

# Secure permissions
chmod 600 ./secrets/*.txt

echo "✅ Created secrets directory with dummy values"
echo "📝 Replace content in ./secrets/*.txt with real values before deploying"
