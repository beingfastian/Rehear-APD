#!/bin/bash
# deploy_to_ec2.sh - Deploy backend to EC2 (Run from backend directory)

set -e

echo "=================================================="
echo "🚀 DEPLOYING TO EC2"
echo "=================================================="

# Configuration
PEM_FILE="instruction-api-key.pem"
EC2_USER="ubuntu"
EC2_HOST="54.162.155.232"
APP_DIR="/home/ubuntu/audio-instruction-api"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}📝 Configuration:${NC}"
echo "  PEM File: $PEM_FILE"
echo "  EC2 Host: $EC2_HOST"
echo "  User: $EC2_USER"
echo "  App Dir: $APP_DIR"
echo ""

# Check PEM file exists
if [ ! -f "$PEM_FILE" ]; then
    echo "❌ Error: $PEM_FILE not found!"
    exit 1
fi

# Set proper permissions
chmod 400 $PEM_FILE
echo -e "${GREEN}✅ PEM file permissions set${NC}"

# Test connection
echo -e "${YELLOW}Testing SSH connection...${NC}"
if ssh -i $PEM_FILE -o ConnectTimeout=5 $EC2_USER@$EC2_HOST "echo 'Connection successful'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH connection successful${NC}"
else
    echo "❌ Cannot connect to EC2"
    exit 1
fi

# Create app directory
echo -e "${YELLOW}Creating app directory...${NC}"
ssh -i $PEM_FILE $EC2_USER@$EC2_HOST "mkdir -p $APP_DIR"

# Upload backend files (we're already in backend directory)
echo -e "${YELLOW}Uploading backend files...${NC}"

# Upload Python files
scp -i $PEM_FILE *.py $EC2_USER@$EC2_HOST:$APP_DIR/ 2>/dev/null || true

# Upload requirements
scp -i $PEM_FILE requirements.txt $EC2_USER@$EC2_HOST:$APP_DIR/ 2>/dev/null || true

# Upload .env file
if [ -f ".env" ]; then
    echo -e "${YELLOW}Uploading .env file...${NC}"
    scp -i $PEM_FILE .env $EC2_USER@$EC2_HOST:$APP_DIR/
else
    echo -e "${YELLOW}⚠️  No .env file found - you'll need to create it on the server${NC}"
fi

# Upload any HTML files
scp -i $PEM_FILE *.html $EC2_USER@$EC2_HOST:$APP_DIR/ 2>/dev/null || true

echo -e "${GREEN}✅ Files uploaded${NC}"

# Install dependencies and setup
echo -e "${YELLOW}Setting up server (this may take a few minutes)...${NC}"
ssh -i $PEM_FILE $EC2_USER@$EC2_HOST << 'ENDSSH'
cd /home/ubuntu/audio-instruction-api

# Update system
echo "Updating system packages..."
sudo apt-get update -qq

# Install Python and dependencies
echo "Installing Python, PostgreSQL, Nginx..."
sudo apt-get install -y python3-pip python3-venv postgresql postgresql-contrib nginx -qq

# Create virtual environment
echo "Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python packages
echo "Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q
pip install gunicorn -q

# Setup PostgreSQL
echo "Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE audio_instructions;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE audio_instructions TO postgres;" 2>/dev/null || true

# Update DATABASE_URL in .env if it exists
if [ -f ".env" ]; then
    sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audio_instructions|' .env
    echo "✅ .env updated with local database URL"
fi

echo "✅ Server setup complete"
ENDSSH

# Create systemd service
echo -e "${YELLOW}Creating systemd service...${NC}"
ssh -i $PEM_FILE $EC2_USER@$EC2_HOST << 'ENDSSH'
sudo tee /etc/systemd/system/audio-api.service > /dev/null << 'EOF'
[Unit]
Description=Audio Instruction API
After=network.target postgresql.service

[Service]
Type=notify
User=ubuntu
WorkingDirectory=/home/ubuntu/audio-instruction-api
Environment="PATH=/home/ubuntu/audio-instruction-api/venv/bin"
ExecStart=/home/ubuntu/audio-instruction-api/venv/bin/gunicorn main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:10000 \
    --timeout 300 \
    --keep-alive 65 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --access-logfile /var/log/audio-api/access.log \
    --error-logfile /var/log/audio-api/error.log
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create log directory
sudo mkdir -p /var/log/audio-api
sudo chown ubuntu:ubuntu /var/log/audio-api

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable audio-api
sudo systemctl restart audio-api

# Wait a moment for service to start
sleep 3

echo "✅ Systemd service created and started"
ENDSSH

# Configure Nginx
echo -e "${YELLOW}Configuring Nginx...${NC}"
ssh -i $PEM_FILE $EC2_USER@$EC2_HOST << 'ENDSSH'
sudo tee /etc/nginx/sites-available/audio-api > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 200M;

    location / {
        proxy_pass http://127.0.0.1:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/audio-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx

echo "✅ Nginx configured"
ENDSSH

# Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ssh -i $PEM_FILE $EC2_USER@$EC2_HOST << 'ENDSSH'
# Check if ufw is active
if sudo ufw status | grep -q "Status: active"; then
    echo "UFW is active, adding rules..."
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
else
    echo "Enabling UFW firewall..."
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
fi
echo "✅ Firewall configured"
ENDSSH

# Check status
echo -e "${YELLOW}Checking service status...${NC}"
ssh -i $PEM_FILE $EC2_USER@$EC2_HOST "sudo systemctl status audio-api --no-pager | head -20"

echo ""
echo "=================================================="
echo -e "${GREEN}✨ DEPLOYMENT COMPLETE!${NC}"
echo "=================================================="
echo ""
echo "Your API is now running at:"
echo "  http://$EC2_HOST"
echo ""
echo "Test it:"
echo "  curl http://$EC2_HOST/"
echo ""
echo "Check logs:"
echo "  ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'sudo journalctl -u audio-api -f'"
echo ""
echo "Restart service:"
echo "  ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'sudo systemctl restart audio-api'"
echo ""
echo "View error logs:"
echo "  ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'sudo tail -f /var/log/audio-api/error.log'"
echo ""
echo "Next steps:"
echo "  1. Test: curl http://$EC2_HOST/"
echo "  2. Update frontend .env.production:"
echo "     REACT_APP_API_URL=http://$EC2_HOST"
echo "  3. Deploy frontend to Vercel"
echo "=================================================="