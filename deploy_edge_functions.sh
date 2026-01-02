#!/bin/bash

# 🎯 Deploy Edge Functions Script
# Usage: ./deploy_edge_functions.sh

set -e

echo "🚀 Deploying Edge Functions..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    print_error "Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    print_error "You are not logged in to Supabase. Please run:"
    echo "supabase login"
    exit 1
fi

# Check if project is linked
if [ ! -f "supabase/config.toml" ]; then
    print_error "Project is not linked. Please run:"
    echo "supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

print_status "Supabase CLI is ready"

# Create functions directory if it doesn't exist
mkdir -p supabase/functions

# Deploy addXP function
echo "📦 Deploying addXP function..."
if supabase functions deploy addXP --no-verify-jwt; then
    print_status "addXP function deployed successfully"
else
    print_error "Failed to deploy addXP function"
    exit 1
fi

# Deploy claimDailyReward function
echo "📦 Deploying claimDailyReward function..."
if supabase functions deploy claimDailyReward --no-verify-jwt; then
    print_status "claimDailyReward function deployed successfully"
else
    print_error "Failed to deploy claimDailyReward function"
    exit 1
fi

# Deploy unlockAchievement function
echo "📦 Deploying unlockAchievement function..."
if supabase functions deploy unlockAchievement --no-verify-jwt; then
    print_status "unlockAchievement function deployed successfully"
else
    print_error "Failed to deploy unlockAchievement function"
    exit 1
fi

echo ""
print_status "All Edge Functions deployed successfully!"
echo ""
print_warning "Next steps:"
echo "1. Set environment variables in Supabase Dashboard:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo ""
echo "2. Test the functions:"
echo "   node test_edge_functions.js"
echo ""
echo "3. Monitor function logs:"
echo "   supabase functions logs addXP"
echo ""
echo "🎉 Ready for production!"
