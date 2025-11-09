#!/bin/bash

# Script to generate self-signed certificates for HTTPS development
# This fixes microphone permission issues on modern browsers

mkdir -p certs

# Check if certificates already exist
if [ -f "certs/key.pem" ] && [ -f "certs/cert.pem" ]; then
    echo "Certificates already exist in certs/ directory"
    exit 0
fi

echo "Generating self-signed certificates for HTTPS development..."

# Generate private key
openssl genrsa -out certs/key.pem 2048

# Generate certificate signing request
openssl req -new -key certs/key.pem -out certs/csr.pem -subj "/C=US/ST=CA/L=San Francisco/O=Dev/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in certs/csr.pem -signkey certs/key.pem -out certs/cert.pem

# Clean up CSR
rm certs/csr.pem

echo "Certificates generated successfully!"
echo "Key: certs/key.pem"
echo "Certificate: certs/cert.pem"
echo ""
echo "Note: You may need to accept the self-signed certificate in your browser."
echo "This enables microphone access on localhost over HTTPS."