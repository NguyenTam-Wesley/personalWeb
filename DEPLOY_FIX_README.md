# 🚀 Deploy XP Fix

## Vấn đề đã sửa:
- **Coins bị ghi đè** thay vì cộng khi hoàn thành game
- **XP không tăng** do Edge Function ghi đè coins

## Các thay đổi:
1. **Edge Function addXP**: Chỉ update XP/level, không touch coins
2. **Rewards.js**: Xử lý level up rewards riêng biệt
3. **Fallback mechanism**: Nếu Edge Function fail thì dùng client-side logic

## Cách deploy:

```bash
# 1. Đảm bảo đã login Supabase CLI
supabase login

# 2. Deploy Edge Function
supabase functions deploy addXP --no-verify-jwt

# 3. Test với file test_xp_fix.html
# Mở http://localhost:8000/test_xp_fix.html trong browser
# - Click "Check Session"
# - Click "Test Game Completion Flow"
# - Kiểm tra XP và Coins có tăng đúng không
```

## Test flow:
1. **Trước khi sửa**: Coins bị ghi đè, XP không tăng
2. **Sau khi sửa**: Coins được cộng, XP tăng đúng

## Files đã thay đổi:
- `supabase/functions/addXP/index.ts`
- `public/js/modules/rewards.js`
- `test_xp_fix.html`

## Expected result:
- ✅ XP tăng từ game rewards + level up
- ✅ Coins tăng từ game rewards + level up bonuses
- ✅ Không bị ghi đè hay mất dữ liệu
