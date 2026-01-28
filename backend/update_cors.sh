#!/bin/bash
# update_cors.sh - Update CORS to allow Vercel

PEM_FILE="instruction-api-key.pem"
EC2_HOST="54.162.155.232"

echo "🔧 UPDATING CORS CONFIGURATION"
echo "=================================================="

# Ask for Vercel URL
echo "Enter your Vercel URL (e.g., https://audio-tool.vercel.app):"
read VERCEL_URL

if [ -z "$VERCEL_URL" ]; then
    echo "❌ No URL provided"
    exit 1
fi

echo ""
echo "Updating CORS to allow: $VERCEL_URL"

# Create updated main.py with correct CORS
ssh -i $PEM_FILE ubuntu@$EC2_HOST << ENDSSH
cd /home/ubuntu/audio-instruction-api

# Backup current main.py
cp main.py main.py.backup

# Update CORS section
python3 << 'PYTHON_SCRIPT'
with open('main.py', 'r') as f:
    content = f.read()

# Find and replace ALLOWED_ORIGINS
import re

old_cors = r'ALLOWED_ORIGINS = \[.*?\]'
new_cors = f'''ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://*.vercel.app",  # All Vercel deployments
    "${VERCEL_URL}",  # Your production URL
]'''

content = re.sub(old_cors, new_cors, content, flags=re.DOTALL)

with open('main.py', 'w') as f:
    f.write(content)

print("✅ CORS updated")
PYTHON_SCRIPT

# Restart service
sudo systemctl restart audio-api

# Wait for restart
sleep 3

# Check status
sudo systemctl status audio-api --no-pager | head -15

echo "✅ Service restarted"
ENDSSH

echo ""
echo "=================================================="
echo "✅ CORS UPDATED!"
echo "=================================================="
echo ""
echo "Your frontend at $VERCEL_URL can now access the API"
echo ""
echo "Test your app:"
echo "  1. Open: $VERCEL_URL"
echo "  2. Try uploading audio"
echo "  3. Check if it connects to backend"
echo ""