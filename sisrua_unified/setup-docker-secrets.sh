#!/bin/bash
# Security hardening script for secrets management
# Run this ONCE to setup secrets properly

set -e

SECRETS_DIR="./secrets"

# Create secrets directory if missing
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

echo "🔐 Configuring Docker secrets..."

# Redis password (generate if missing)
if [ ! -f "$SECRETS_DIR/redis_password.txt" ]; then
    echo "Generating Redis password..."
    # Generate 32 random characters
    openssl rand -base64 24 > "$SECRETS_DIR/redis_password.txt"
    chmod 600 "$SECRETS_DIR/redis_password.txt"
    echo "✅ Redis password created: $SECRETS_DIR/redis_password.txt"
else
    echo "✓ Redis password already exists"
fi

# Add secrets dir to .gitignore (if not already there)
if ! grep -q "^secrets/" .gitignore 2>/dev/null; then
    echo "secrets/" >> .gitignore
    echo "✅ Added secrets/ to .gitignore"
fi

echo ""
echo "✅ Secrets configured successfully!"
echo ""
echo "📝 IMPORTANT:"
echo "   1. Secrets are stored in ./secrets/ (NEVER commit these)"
echo "   2. Use: docker compose -f docker-compose.prod.yml up"
echo "   3. For development: docker compose -f docker-compose.dev.yml up"
