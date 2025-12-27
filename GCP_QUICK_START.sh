#!/bin/bash

# 🚀 WiseReels Backend - GCP Deployment Quick Start Script
# This script automates the GCP deployment process
# Usage: bash GCP_QUICK_START.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="wisereels"
INSTANCE_NAME="wisereels-postgres"
REDIS_INSTANCE="wisereels-redis"
SERVICE_NAME="wisereels-backend"
REGION="us-central1"
IMAGE_NAME="wisereels-backend"
SERVICE_ACCOUNT_NAME="wisereels-backend"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Create GCP Project
step_create_project() {
    log_info "Step 1: Creating GCP Project..."
    
    PROJECT_ID="${PROJECT_NAME}-$(date +%s)"
    
    gcloud projects create $PROJECT_ID --name="$PROJECT_NAME"
    gcloud config set project $PROJECT_ID
    
    log_success "Project created: $PROJECT_ID"
    
    # Save project ID for later use
    echo "$PROJECT_ID" > .gcp_project_id
    
    # Setup billing
    log_warning "Please ensure billing is enabled for this project"
    log_info "To enable billing, visit: https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
    read -p "Press enter once billing is enabled..."
}

# Step 2: Enable APIs
step_enable_apis() {
    log_info "Step 2: Enabling required Google Cloud APIs..."
    
    gcloud services enable \
        cloudsql.googleapis.com \
        sqladmin.googleapis.com \
        compute.googleapis.com \
        run.googleapis.com \
        containerregistry.googleapis.com \
        artifactregistry.googleapis.com \
        redis.googleapis.com \
        cloudresourcemanager.googleapis.com \
        servicenetworking.googleapis.com
    
    log_success "All APIs enabled"
}

# Step 3: Create Cloud SQL
step_create_cloud_sql() {
    log_info "Step 3: Creating Cloud SQL PostgreSQL instance..."
    
    gcloud sql instances create $INSTANCE_NAME \
        --database-version=POSTGRES_15 \
        --tier=db-custom-2-7680 \
        --region=$REGION \
        --no-assign-ip \
        --network=default \
        --backup-start-time="03:00" \
        --enable-bin-log \
        --retained-backups-count=7
    
    log_success "Cloud SQL instance created (this may take 5-10 minutes)"
    
    # Get connection name
    INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME \
        --format='value(connectionName)')
    echo "$INSTANCE_CONNECTION_NAME" > .gcp_sql_connection_name
    
    log_info "Connection Name: $INSTANCE_CONNECTION_NAME"
}

# Step 4: Setup Database
step_setup_database() {
    log_info "Step 4: Setting up database..."
    
    INSTANCE_CONNECTION_NAME=$(cat .gcp_sql_connection_name)
    
    # Set root password
    read -sp "Enter PostgreSQL root password: " POSTGRES_PASSWORD
    echo
    
    gcloud sql users set-password postgres \
        --instance=$INSTANCE_NAME \
        --password=$POSTGRES_PASSWORD
    
    log_success "Root password set"
    
    # Create database
    gcloud sql databases create wisereels --instance=$INSTANCE_NAME
    
    # Create app user
    APP_PASSWORD=$(openssl rand -base64 32)
    
    log_info "Creating application user..."
    gcloud sql connect $INSTANCE_NAME \
        --user=postgres \
        << EOF
CREATE USER wisereels_app WITH PASSWORD '$APP_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE wisereels TO wisereels_app;
GRANT USAGE ON SCHEMA public TO wisereels_app;
GRANT CREATE ON SCHEMA public TO wisereels_app;
\q
EOF
    
    echo "$APP_PASSWORD" > .gcp_app_db_password
    log_success "Database and app user created"
}

# Step 5: Create Redis
step_create_redis() {
    log_info "Step 5: Creating Cloud Memorystore (Redis)..."
    
    gcloud redis instances create $REDIS_INSTANCE \
        --size=2 \
        --region=$REGION \
        --tier=basic \
        --redis-version=7.0
    
    log_success "Redis instance created (this may take 3-5 minutes)"
    
    # Get Redis details
    REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE \
        --region=$REGION \
        --format='value(host)')
    
    REDIS_PORT=$(gcloud redis instances describe $REDIS_INSTANCE \
        --region=$REGION \
        --format='value(port)')
    
    echo "$REDIS_HOST:$REDIS_PORT" > .gcp_redis_connection
    log_info "Redis: $REDIS_HOST:$REDIS_PORT"
}

# Step 6: Create Service Account
step_create_service_account() {
    log_info "Step 6: Creating service account..."
    
    PROJECT_ID=$(cat .gcp_project_id)
    
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="WiseReels Backend Service Account"
    
    SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
    echo "$SERVICE_ACCOUNT_EMAIL" > .gcp_service_account_email
    
    log_success "Service account created: $SERVICE_ACCOUNT_EMAIL"
    
    # Assign roles
    log_info "Assigning IAM roles..."
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/cloudsql.client" &>/dev/null
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/cloudsql.editor" &>/dev/null
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/redis.admin" &>/dev/null
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
        --role="roles/run.invoker" &>/dev/null
    
    log_success "IAM roles assigned"
}

# Step 7: Build and Push Docker Image
step_build_docker() {
    log_info "Step 7: Building and pushing Docker image..."
    
    if [ ! -f "Dockerfile" ]; then
        log_error "Dockerfile not found in current directory"
        return 1
    fi
    
    PROJECT_ID=$(cat .gcp_project_id)
    REGISTRY_URL="gcr.io"
    
    log_info "Building Docker image..."
    docker build -t $REGISTRY_URL/$PROJECT_ID/$IMAGE_NAME:latest .
    
    log_info "Pushing to Container Registry..."
    gcloud auth configure-docker
    docker push $REGISTRY_URL/$PROJECT_ID/$IMAGE_NAME:latest
    
    log_success "Docker image built and pushed"
}

# Step 8: Deploy to Cloud Run
step_deploy_cloud_run() {
    log_info "Step 8: Deploying to Cloud Run..."
    
    PROJECT_ID=$(cat .gcp_project_id)
    SERVICE_ACCOUNT_EMAIL=$(cat .gcp_service_account_email)
    INSTANCE_CONNECTION_NAME=$(cat .gcp_sql_connection_name)
    
    IMAGE_URL="gcr.io/$PROJECT_ID/$IMAGE_NAME:latest"
    
    gcloud run deploy $SERVICE_NAME \
        --image=$IMAGE_URL \
        --platform=managed \
        --region=$REGION \
        --no-allow-unauthenticated \
        --service-account=$SERVICE_ACCOUNT_EMAIL \
        --memory=2Gi \
        --cpu=2 \
        --timeout=3600 \
        --set-cloudsql-instances=$INSTANCE_CONNECTION_NAME \
        --min-instances=1 \
        --max-instances=10
    
    log_success "Service deployed to Cloud Run"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
        --region=$REGION \
        --format='value(status.url)')
    
    echo "$SERVICE_URL" > .gcp_service_url
    log_info "Service URL: $SERVICE_URL"
}

# Step 9: Configure Environment Variables
step_configure_env() {
    log_info "Step 9: Configuring environment variables..."
    
    PROJECT_ID=$(cat .gcp_project_id)
    INSTANCE_CONNECTION_NAME=$(cat .gcp_sql_connection_name)
    APP_PASSWORD=$(cat .gcp_app_db_password)
    REDIS_CONNECTION=$(cat .gcp_redis_connection)
    
    # Ask for sensitive values
    read -p "Enter JWT_SECRET: " JWT_SECRET
    read -p "Enter TWILIO_ACCOUNT_SID: " TWILIO_SID
    read -sp "Enter TWILIO_AUTH_TOKEN: " TWILIO_TOKEN
    echo
    read -p "Enter TWILIO_PHONE_NUMBER: " TWILIO_PHONE
    
    IFS=':' read -r REDIS_HOST REDIS_PORT <<< "$REDIS_CONNECTION"
    
    gcloud run services update $SERVICE_NAME \
        --region=$REGION \
        --set-env-vars="\
NODE_ENV=production,\
PORT=3000,\
DATABASE_HOST=/cloudsql/$INSTANCE_CONNECTION_NAME,\
DATABASE_PORT=5432,\
DATABASE_NAME=wisereels,\
DATABASE_USER=wisereels_app,\
DATABASE_PASSWORD=$APP_PASSWORD,\
REDIS_HOST=$REDIS_HOST,\
REDIS_PORT=$REDIS_PORT,\
JWT_SECRET=$JWT_SECRET,\
JWT_EXPIRE=7d,\
TWILIO_ACCOUNT_SID=$TWILIO_SID,\
TWILIO_AUTH_TOKEN=$TWILIO_TOKEN,\
TWILIO_PHONE_NUMBER=$TWILIO_PHONE,\
LOG_LEVEL=info"
    
    log_success "Environment variables configured"
}

# Step 10: Test Deployment
step_test_deployment() {
    log_info "Step 10: Testing deployment..."
    
    SERVICE_URL=$(cat .gcp_service_url)
    
    log_info "Testing health endpoint..."
    RESPONSE=$(curl -s "$SERVICE_URL/health")
    
    if echo "$RESPONSE" | grep -q "OK"; then
        log_success "Health check passed"
        log_info "Response: $RESPONSE"
    else
        log_error "Health check failed"
        log_info "Response: $RESPONSE"
    fi
}

# Cleanup
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f .gcp_*
    log_success "Cleanup complete"
}

# Main menu
main_menu() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  WiseReels Backend - GCP Deployment   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "Select deployment steps:"
    echo "1) Full deployment (all steps)"
    echo "2) Create project and APIs"
    echo "3) Create Cloud SQL"
    echo "4) Setup Database"
    echo "5) Create Redis"
    echo "6) Create Service Account"
    echo "7) Build and push Docker"
    echo "8) Deploy to Cloud Run"
    echo "9) Configure environment variables"
    echo "10) Test deployment"
    echo "11) View all configuration"
    echo "0) Exit"
    echo ""
    read -p "Enter your choice (0-11): " choice
}

# View configuration
view_config() {
    log_info "Current GCP Configuration:"
    echo ""
    
    if [ -f ".gcp_project_id" ]; then
        echo "Project ID: $(cat .gcp_project_id)"
    fi
    
    if [ -f ".gcp_sql_connection_name" ]; then
        echo "Cloud SQL: $(cat .gcp_sql_connection_name)"
    fi
    
    if [ -f ".gcp_redis_connection" ]; then
        echo "Redis: $(cat .gcp_redis_connection)"
    fi
    
    if [ -f ".gcp_service_account_email" ]; then
        echo "Service Account: $(cat .gcp_service_account_email)"
    fi
    
    if [ -f ".gcp_service_url" ]; then
        echo "Service URL: $(cat .gcp_service_url)"
    fi
    
    echo ""
}

# Main loop
while true; do
    main_menu
    
    case $choice in
        1)
            log_info "Starting full deployment..."
            step_create_project
            step_enable_apis
            step_create_cloud_sql
            step_setup_database
            step_create_redis
            step_create_service_account
            step_build_docker
            step_deploy_cloud_run
            step_configure_env
            step_test_deployment
            log_success "Full deployment complete!"
            view_config
            ;;
        2) step_create_project; step_enable_apis ;;
        3) step_create_cloud_sql ;;
        4) step_setup_database ;;
        5) step_create_redis ;;
        6) step_create_service_account ;;
        7) step_build_docker ;;
        8) step_deploy_cloud_run ;;
        9) step_configure_env ;;
        10) step_test_deployment ;;
        11) view_config ;;
        0)
            cleanup
            log_success "Goodbye!"
            exit 0
            ;;
        *)
            log_error "Invalid choice"
            ;;
    esac
done
