# 🎯 Edge Functions Setup Guide

## Tổng quan

Đã implement **3 Edge Functions** để xử lý game logic phức tạp một cách an toàn và hiệu quả:

1. **`addXP`** - Xử lý XP, level up, và rewards
2. **`claimDailyReward`** - Quản lý daily rewards với streak logic
3. **`unlockAchievement`** - Tự động unlock achievements dựa trên triggers

## 🚀 Deploy Edge Functions

### 1. Cài đặt Supabase CLI

```bash
npm install -g supabase
```

### 2. Login Supabase

```bash
supabase login
```

### 3. Link project

```bash
supabase link --project-ref your-project-ref
```

### 4. Deploy Edge Functions

```bash
# Deploy từng function
supabase functions deploy addXP
supabase functions deploy claimDailyReward
supabase functions deploy unlockAchievement

# Hoặc deploy tất cả
supabase functions deploy
```

## 🛠️ Cấu hình Environment Variables

Trong Supabase Dashboard → Edge Functions → Environment Variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
```

## 📋 API Endpoints

### addXP
```http
POST /functions/v1/addXP
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "amount": 25,
  "reason": "game_completion",
  "reference_id": "optional-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "old_level": 3,
    "new_level": 4,
    "xp_gained": 25,
    "level_up": true,
    "rewards": {
      "coins": 50,
      "gems": 2
    }
  }
}
```

### claimDailyReward
```http
POST /functions/v1/claimDailyReward
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "day": 3,
    "streak": 7,
    "rewards": {
      "coins": 20,
      "gems": 1
    },
    "next_claim_available": "2025-12-31T00:00:00.000Z"
  }
}
```

### unlockAchievement
```http
POST /functions/v1/unlockAchievement
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "trigger_type": "games_completed",
  "trigger_data": {
    "difficulty": "hard"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unlocked_count": 2,
    "achievements": [
      {
        "id": "uuid",
        "name": "Puzzle Master",
        "rewards": {
          "coins": 100,
          "gems": 0,
          "xp": 50
        }
      }
    ]
  }
}
```

## 🔒 Security Features

### Authentication
- ✅ JWT token validation
- ✅ User isolation (RLS)
- ✅ Secure database operations

### Data Validation
- ✅ Input sanitization
- ✅ Business logic validation
- ✅ Atomic transactions

### Error Handling
- ✅ Comprehensive error responses
- ✅ Graceful failure handling
- ✅ Logging for debugging

## 🎮 Game Logic Implementation

### XP & Level System
```typescript
// Automatic level calculation
const { data: levelResult } = await supabaseClient
  .rpc('calculate_level_and_xp', { total_xp: totalXP })

// Level up rewards
for (let level = oldLevel + 1; level <= newLevel; level++) {
  const rewards = await getLevelRewards(level)
  await grantRewards(rewards)
}
```

### Daily Rewards với Streak
```typescript
// Calculate streak logic
const streak = calculateCurrentStreak(userId)

// Get cycle start date
const cycleStart = await supabaseClient.rpc('get_current_cycle_start')

// Safe currency addition with logging
await supabaseClient.rpc('add_currency_with_log', {
  p_user_id: userId,
  p_currency_type: 'coins',
  p_amount: rewardAmount,
  p_reason: 'daily_reward'
})
```

### Achievement System
```typescript
// Check multiple trigger types
switch (triggerType) {
  case 'games_completed':
    // Check total games played
  case 'best_time':
    // Check sudoku_scores table
  case 'level_reached':
    // Check user level
  case 'streak':
    // Check best streak
}
```

## 🎨 UI Notifications

### Level Up Popup
```javascript
showLevelUpNotification(newLevel, rewards) {
  // Animated notification với rewards
  // Auto-hide after 5 seconds
}
```

### Achievement Notifications
```javascript
showAchievementNotification(achievement) {
  // Trophy icon + achievement name
  // Reward breakdown
  // Queue multiple notifications
}
```

## 🧪 Testing

### Unit Tests cho Edge Functions
```bash
# Chạy tests
supabase test
```

### Manual Testing
```bash
# Invoke function locally
supabase functions serve addXP
curl -X POST http://localhost:54321/functions/v1/addXP \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'
```

## 📊 Monitoring & Analytics

### Database Views
```sql
-- User profiles with calculated fields
CREATE VIEW v_user_profiles AS
SELECT *,
  get_xp_needed_for_level(level) as xp_needed,
  ROUND((xp::DECIMAL / get_xp_needed_for_level(level)) * 100, 2) as progress
FROM user_profiles;

-- Currency transaction logs
CREATE VIEW v_currency_transactions AS
SELECT *,
  CASE
    WHEN amount > 0 THEN 'earned'
    ELSE 'spent'
  END as transaction_type
FROM currency_transactions;
```

### Performance Monitoring
- Response times < 500ms
- Error rates < 1%
- Cache hit rates > 95%

## 🚨 Troubleshooting

### Common Issues

1. **"Unauthorized" error**
   - Check JWT token validity
   - Verify user authentication

2. **"Insufficient currency" error**
   - Check user balance before operations
   - Use database constraints

3. **Achievement not unlocking**
   - Verify trigger conditions
   - Check database state
   - Review RLS policies

### Debug Commands
```bash
# View function logs
supabase functions logs addXP

# Check database state
supabase db inspect

# Reset function
supabase functions delete addXP
supabase functions deploy addXP
```

## 🎯 Performance Optimizations

- **Edge Function caching** cho config data
- **Database indexing** trên frequently queried columns
- **Batch operations** cho multiple rewards
- **Connection pooling** cho database calls

## 📈 Scaling Considerations

- **Rate limiting** cho high-frequency calls
- **Queue system** cho achievement processing
- **Database partitioning** cho large user bases
- **CDN integration** cho static assets

---

## 🎉 Kết luận

Edge Functions đã **hoàn thiện architecture**:

- ✅ **Secure**: JWT auth + RLS
- ✅ **Scalable**: Serverless trên Edge
- ✅ **Maintainable**: Clean separation of concerns
- ✅ **User Experience**: Real-time notifications

**Ready for production! 🚀**
