#!/bin/bash
# deploy_fullstack_ec2.sh - Deploy BOTH frontend and backend on EC2

set -e

PEM_FILE="instruction-api-key.pem"
EC2_USER="ubuntu"
EC2_HOST="13.63.13.113"
BACKEND_DIR="/home/ubuntu/audio-instruction-api"
FRONTEND_DIR="/home/ubuntu/audio-instruction-frontend"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=================================================="
echo "🚀 DEPLOYING FULL-STACK APP TO EC2"
echo "=================================================="
echo ""
echo "This will deploy:"
echo "  • Backend (FastAPI) → Port 10000"
echo "  • Frontend (React) → Port 80 (via Nginx)"
echo "  • Everything accessible at: http://$EC2_HOST"
echo ""

# Check if we're in the right directory
if [ ! -d "../frontend" ]; then
    echo "❌ Error: frontend directory not found"
    echo "Please run this from the backend directory"
    exit 1
fi

chmod 400 $PEM_FILE

echo -e "${YELLOW}Step 1: Uploading backend files...${NC}"
ssh -i $PEM_FILE $EC2_USER@$EC2_HOST "mkdir -p $BACKEND_DIR"
scp -i $PEM_FILE *.py $EC2_USER@$EC2_HOST:$BACKEND_DIR/ 2>/dev/null || true
scp -i $PEM_FILE requirements.txt $EC2_USER@$EC2_HOST:$BACKEND_DIR/ 2>/dev/null || true
scp -i $PEM_FILE .env $EC2_USER@$EC2_HOST:$BACKEND_DIR/ 2>/dev/null || true
echo -e "${GREEN}✅ Backend files uploaded${NC}"

echo -e "${YELLOW}Step 2: Building frontend locally...${NC}"
cd ../frontend

# Create production .env
cat > .env.production << EOF
REACT_APP_API_URL=http://$EC2_HOST
EOF

# Install and build
npm install
npm run build

echo -e "${GREEN}✅ Frontend built${NC}"

echo -e "${YELLOW}Step 3: Uploading frontend build...${NC}"
ssh -i ../backend/$PEM_FILE $EC2_USER@$EC2_HOST "mkdir -p $FRONTEND_DIR"
scp -i ../backend/$PEM_FILE -r build/* $EC2_USER@$EC2_HOST:$FRONTEND_DIR/

echo -e "${GREEN}✅ Frontend uploaded${NC}"

cd ../backend

echo -e "${YELLOW}Step 4: Configuring server...${NC}"
ssh -i $PEM_FILE $EC2_USER@$EC2_HOST << 'ENDSSH'

# Update system
sudo apt-get update -qq
sudo apt-get install -y python3-pip python3-venv postgresql nginx -qq

# Setup backend
cd /home/ubuntu/audio-instruction-api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q
pip install gunicorn -q

# Setup PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE audio_instructions;" 2>/dev/null || true
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true

# Update .env
if [ -f ".env" ]; then
    sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audio_instructions|' .env
fi

# Create backend systemd service
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
    --bind 127.0.0.1:10000 \
    --timeout 300
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx to serve both frontend and backend
sudo tee /etc/nginx/sites-available/fullstack-app > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    # Serve frontend (React build)
    location / {
        root /home/ubuntu/audio-instruction-frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://127.0.0.1:10000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        client_max_body_size 200M;
    }

    # Also allow direct backend access (without /api prefix)
    location ~ ^/(analyze-audio|jobs|health)$ {
        proxy_pass http://127.0.0.1:10000$request_uri;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 200M;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/fullstack-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/audio-api

# Test and restart services
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable audio-api
sudo systemctl restart audio-api
sudo systemctl restart nginx

echo "✅ Server configured"

ENDSSH

echo ""
echo "=================================================="
echo -e "${GREEN}✨ DEPLOYMENT COMPLETE!${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}Your full-stack app is now live at:${NC}"
echo -e "${GREEN}http://$EC2_HOST${NC}"
echo ""
echo "Test it:"
echo "  1. Open: http://$EC2_HOST"
echo "  2. You should see the React frontend"
echo "  3. Upload audio and test functionality"
echo ""
echo "Backend API:"
echo "  http://$EC2_HOST/health"
echo "  http://$EC2_HOST/jobs"
echo ""
echo "Check logs:"
echo "  Backend: ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'sudo journalctl -u audio-api -f'"
echo "  Nginx:   ssh -i $PEM_FILE $EC2_USER@$EC2_HOST 'sudo tail -f /var/log/nginx/error.log'"
echo "=================================================="