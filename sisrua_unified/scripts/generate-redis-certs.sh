#!/bin/bash
# Generate self-signed certificates for Redis TLS in development
# Based on Redis official documentation for TLS

set -e

# Configuration
SECRET_DIR="./secrets"
CA_NAME="redis_ca"
CERT_NAME="redis_cert"
KEY_NAME="redis_key"

mkdir -p $SECRET_DIR

# 1. Create CA
openssl genrsa -out $SECRET_DIR/$CA_NAME.pem 4096
openssl req -x509 -new -nodes -sha256 -key $SECRET_DIR/$CA_NAME.pem -days 3650 -subj "/O=sisRUA/CN=sisRUA CA" -out $SECRET_DIR/$CA_NAME.pem

# 2. Create Server Key and Certificate Request
openssl genrsa -out $SECRET_DIR/$KEY_NAME.pem 2048
openssl req -new -sha256 -key $SECRET_DIR/$KEY_NAME.pem -subj "/O=sisRUA/CN=sisrua-redis" -out $SECRET_DIR/$CERT_NAME.csr

# 3. Sign the Certificate with our CA
openssl x509 -req -in $SECRET_DIR/$CERT_NAME.csr -CA $SECRET_DIR/$CA_NAME.pem -CAkey $SECRET_DIR/$CA_NAME.pem -CAcreateserial -out $SECRET_DIR/$CERT_NAME.pem -days 365 -sha256

# Cleanup
rm $SECRET_DIR/$CERT_NAME.csr
rm $SECRET_DIR/$CA_NAME.srl

# Secure permissions
chmod 600 $SECRET_DIR/*.pem

echo "✅ Redis TLS certificates generated in $SECRET_DIR"
