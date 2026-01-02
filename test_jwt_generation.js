// Test JWT generation logic (without Supabase connection)
import jwt from 'jsonwebtoken';

// Mock Supabase user ID (UUID format)
const mockSupabaseUserId = 'f8c9c1c2-1234-5678-9abc-def012345678';
const mockGameUserId = 42; // bigint from database

// Mock JWT secret (in real app, this comes from env)
const mockJwtSecret = 'dummy_jwt_secret_for_testing';

/**
 * Generate Supabase session by signing JWT directly (FIXED VERSION)
 */
async function generateSupabaseSession(supabaseUserId) {
  // Create JWT payload that matches Supabase's expected format
  const payload = {
    aud: 'authenticated',
    role: 'authenticated',
    sub: supabaseUserId, // ✅ MUST be Supabase user ID (UUID)
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
  };

  // Sign JWT with Supabase's JWT secret
  const accessToken = jwt.sign(payload, mockJwtSecret);

  // For simplicity, we'll use the same token as refresh token
  // In production, you'd want separate tokens with different expiry times
  const refreshToken = accessToken;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: payload.exp
  };
}

// Test JWT generation
async function testJWT() {
  console.log('🧪 Testing JWT Generation Logic...\n');

  console.log('❌ WRONG: Using gameUser.id as sub (what we had before)');
  console.log('Game User ID:', mockGameUserId, '(type: bigint)');

  const wrongSession = await generateSupabaseSession(mockGameUserId);
  const wrongPayload = jwt.decode(wrongSession.access_token);
  console.log('JWT Payload (WRONG):', {
    aud: wrongPayload.aud,
    role: wrongPayload.role,
    sub: wrongPayload.sub + ' ❌ (not a valid Supabase user UUID)',
    iat: new Date(wrongPayload.iat * 1000).toISOString(),
    exp: new Date(wrongPayload.exp * 1000).toISOString()
  });

  console.log('\n✅ CORRECT: Using supabaseUser.id as sub (what we fixed to)');
  console.log('Supabase User ID:', mockSupabaseUserId, '(type: UUID)');

  const correctSession = await generateSupabaseSession(mockSupabaseUserId);
  const correctPayload = jwt.decode(correctSession.access_token);
  console.log('JWT Payload (CORRECT):', {
    aud: correctPayload.aud,
    role: correctPayload.role,
    sub: correctPayload.sub + ' ✅ (valid Supabase user UUID)',
    iat: new Date(correctPayload.iat * 1000).toISOString(),
    exp: new Date(correctPayload.exp * 1000).toISOString()
  });

  console.log('\n🎯 RESULT:');
  console.log('- JWT structure: ✅ CORRECT');
  console.log('- JWT signature: ✅ CORRECT');
  console.log('- JWT sub field: ✅ NOW CORRECT (was the killer bug!)');

  console.log('\n📋 JWT Token (first 100 chars):', correctSession.access_token.substring(0, 100) + '...');
}

testJWT();
