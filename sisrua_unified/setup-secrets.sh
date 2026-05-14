#!/bin/bash
# CREATE SECRETS DIRECTORY WITH DUMMY VALUES
# This is required for docker-compose up to work

mkdir -p ./secrets

# Create dummy secrets (replace with real values in production)
if [ ! -f ./secrets/redis_password.txt ]; then
    echo "redis-REPLACE-WITH-REAL-PASSWORD" > ./secrets/redis_password.txt
fi

# Generate TLS certificates for Redis
if [ -f ./scripts/generate-redis-certs.sh ]; then
    bash ./scripts/generate-redis-certs.sh
fi

# Secure permissions
chmod 600 ./secrets/*.txt ./secrets/*.pem 2>/dev/null || true

echo "✅ Created secrets directory with dummy values and TLS certs"
echo "📝 Replace content in ./secrets/redis_password.txt with real values before deploying"
