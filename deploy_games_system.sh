#!/bin/bash

echo "🚀 Deploying Games System..."

# Reset database with new schema
echo "📊 Resetting database..."
supabase db reset --linked

# Seed games data
echo "🎮 Seeding games data..."
psql -h localhost -U postgres -d postgres -f sql/seed_games_data.sql

# Deploy Edge Functions
echo "⚡ Deploying Edge Functions..."
supabase functions deploy submitGameResult
supabase functions deploy unlockAchievement

echo "✅ Games System deployed successfully!"
echo ""
echo "🎯 Test the system:"
echo "1. Open Sudoku game"
echo "2. Complete a puzzle"
echo "3. Check best score and rank display"
echo "4. Check leaderboard popup"
