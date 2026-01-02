import process from "node:process";
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

console.log('ENV CHECK:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  JWT: !!process.env.SUPABASE_JWT_SECRET,
});

const router = express.Router();

// ✅ FIX 1: Supabase Admin Client with service role key
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,  // ✅ Added API key here!
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Supabase Public Client (for session creation)
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verify game user credentials against our custom users table
 */
async function verifyGameUser(username, password) {
  const { data, error } = await supabasePublic
    .from('users')
    .select('id, username, role, password')
    .eq('username', username)
    .single();

  if (error || !data) {
    console.error('❌ User not found:', username);
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, data.password);
  if (!isValidPassword) {
    console.error('❌ Invalid password for user:', username);
    throw new Error('Invalid credentials');
  }

  console.log('✅ User verified:', username);
  return {
    id: data.id,
    username: data.username,
    role: data.role
  };
}

/**
 * Ensure Supabase user exists and is mapped to game user
 */
async function ensureSupabaseUser(gameUserId) {
  const email = `game_${gameUserId}@internal.local`;

  // Check if Supabase user already exists
  const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    console.error('❌ Error listing users:', listError);
  }

  // Find user with matching game_user_id in metadata
  let existingUser = null;
  if (existingUsers && existingUsers.users) {
    existingUser = existingUsers.users.find(user =>
      user.user_metadata?.game_user_id == gameUserId
    );
  }

  if (!existingUser) {
    console.log('🆕 Creating new Supabase user for game_user_id:', gameUserId);
    // Create new Supabase user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: {
        game_user_id: gameUserId,
        provider: 'game_auth'
      },
      password: Math.random().toString(36), // Random password, never used
    });

    if (createError) {
      console.error('❌ Error creating Supabase user:', createError);
      throw new Error('Failed to create Supabase user');
    }

    existingUser = newUser.user;
  }

  console.log('✅ Supabase user ready:', existingUser.id);
  return existingUser;
}

/**
 * Generate Supabase session for the user by signing JWT directly
 */
function generateSupabaseSession(supabaseUserId) {
  const payload = {
    aud: 'authenticated',
    role: 'authenticated',
    sub: supabaseUserId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
  };

  const accessToken = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET);
  const refreshToken = accessToken;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: payload.exp
  };
}

/**
 * Update login count for game user
 */
async function updateLoginCount(gameUserId) {
  // First get current login_count
  const { data: currentUser, error: fetchError } = await supabasePublic
    .from('users')
    .select('login_count')
    .eq('id', gameUserId)
    .single();

  if (fetchError) {
    console.warn('⚠️ Failed to fetch current login count:', fetchError);
    return;
  }

  const newCount = (currentUser?.login_count || 0) + 1;

  // Update with new count
  const { error } = await supabasePublic
    .from('users')
    .update({
      login_count: newCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', gameUserId);

  if (error) {
    console.warn('⚠️ Failed to update login count:', error);
  } else {
    console.log(`📊 Login count updated to ${newCount} for user ${gameUserId}`);
  }
}

/**
 * POST /auth/login
 * Game user login endpoint - returns Supabase JWT
 */
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Login attempt:', req.body.username);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // 1. Verify game user credentials
    const gameUser = await verifyGameUser(username, password);

    // 2. Ensure Supabase user exists
    const supabaseUser = await ensureSupabaseUser(gameUser.id);

    // 3. Generate Supabase session (JWT)
    console.log('🔑 Generating JWT for supabaseUser.id:', supabaseUser.id);
    const session = generateSupabaseSession(supabaseUser.id);

    // 4. Update login count
    await updateLoginCount(gameUser.id);

    console.log('✅ Login successful for:', username);

    // 5. Return session data
    res.json({
      success: true,
      data: {
        user: {
          id: gameUser.id,
          username: gameUser.username,
          role: gameUser.role,
          supabase_user_id: supabaseUser.id
        },
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at
        }
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    });
  }
});

/**
 * POST /auth/register
 * Register new game user
 */
router.post('/register', async (req, res) => {
  try {
    console.log('📝 Registration attempt:', req.body.username);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if username exists
    const { data: existing, error: checkError } = await supabasePublic
      .from('users')
      .select('id')
      .eq('username', username);

    if (checkError) {
      console.error('❌ Error checking username:', checkError);
      return res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create game user
    const { data, error } = await supabasePublic
      .from('users')
      .insert([{
        username,
        password: hashedPassword,
        role: 'user'
      }])
      .select('id, username, role')
      .single();

    if (error) {
      console.error('❌ Error creating user:', error);
      return res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }

    console.log('✅ User registered:', username);

    res.json({
      success: true,
      data: {
        user: data
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    });
  }
});

/**
 * POST /auth/logout
 * Logout endpoint (client-side cleanup)
 */
router.post('/logout', (_req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;