import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.205.0/http/server.ts";

// Type alias for Supabase client
type SupabaseType = SupabaseClient;

// Types for better type safety
// Types for better type safety
interface GameResultRequest {
  game_code: string;
  mode_code?: string;
  metric_type: MetricType;
  metric_value: number;
  extra_data?: Record<string, unknown>;
}

interface GameSessionInsert {
  user_id: string;
  game_id: string;
  mode_id: string | null;
  metric_type: MetricType;
  metric_value: number;
  extra_data: Record<string, unknown>;
  rewarded: boolean;
}

// Types for anti-cheat rules
interface TimeAntiCheatRule {
  min: number;
  message: string;
}

interface ScoreAntiCheatRule {
  max: number;
  message: string;
}

type AntiCheatRules = {
  time: TimeAntiCheatRule;
  score: ScoreAntiCheatRule;
};

// Types derived from configuration (rule-driven approach)
type MetricType = keyof typeof ANTI_CHEAT_RULES;

// Custom error classes for better error handling
class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}
const ANTI_CHEAT_RULES: AntiCheatRules = {
  time: { min: 10, message: "Suspicious time value" },
  score: { max: 10_000_000, message: "Suspicious score value" }
} as const;

// Constants for validation (derived from rules)
const VALID_METRIC_TYPES = Object.keys(ANTI_CHEAT_RULES) as MetricType[];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
} as const;

/**
 * Validates the incoming request body
 */
function validateRequest(body: unknown): { isValid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: "Invalid request body" };
  }

  const data = body as Record<string, unknown>;
  const { game_code, mode_code, metric_type, metric_value } = data;

  if (!game_code || typeof game_code !== 'string') {
    return { isValid: false, error: "Missing or invalid game_code" };
  }

  if (mode_code && typeof mode_code !== 'string') {
    return { isValid: false, error: "Invalid mode_code" };
  }

  if (!metric_type || typeof metric_type !== 'string' || !VALID_METRIC_TYPES.includes(metric_type as MetricType)) {
    return { isValid: false, error: `Invalid metric_type. Must be one of: ${VALID_METRIC_TYPES.join(', ')}` };
  }

  if (typeof metric_value !== 'number' || metric_value <= 0 || !Number.isFinite(metric_value)) {
    return { isValid: false, error: "Invalid metric_value. Must be a positive finite number" };
  }

  return { isValid: true };
}

/**
 * Performs basic anti-cheat validation
 */
function validateAntiCheat(metric_type: MetricType, metric_value: number): { isValid: boolean; error?: string } {
  const rule = ANTI_CHEAT_RULES[metric_type];

  if (metric_type === 'time' && 'min' in rule && metric_value < rule.min) {
    return { isValid: false, error: rule.message };
  }

  if (metric_type === 'score' && 'max' in rule && metric_value > rule.max) {
    return { isValid: false, error: rule.message };
  }

  return { isValid: true };
}

/**
 * Creates a standardized error response
 */
function createErrorResponse(error: string, status: number, details?: unknown) {
  const response = { error };
  if (details && typeof details === 'object') {
    Object.assign(response, { details });
  }

  return new Response(JSON.stringify(response), {
    status,
    headers: CORS_HEADERS
  });
}

/**
 * Creates a standardized success response
 */
function createSuccessResponse(data: unknown) {
  return new Response(JSON.stringify({ success: true, ...(data as Record<string, unknown>) }), {
    status: 200,
    headers: CORS_HEADERS
  });
}

/**
 * Authenticates the user using the global Authorization header
 */
async function authenticateUser(supabase: SupabaseType) {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw new AuthError(`Authentication failed: ${error.message}`);
  }

  if (!user) {
    throw new AuthError("User not found");
  }

  return user;
}

/**
 * Fetches game by code
 */
async function fetchGame(supabase: SupabaseType, gameCode: string) {
  const { data: game, error } = await supabase
    .from("games")
    .select("id")
    .eq("code", gameCode)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Game fetch failed: ${error.message}`);
  }

  if (!game) {
    throw new NotFoundError(`Game "${gameCode}"`);
  }

  return game;
}

/**
 * Fetches game mode by code (optional)
 */
async function fetchGameMode(supabase: SupabaseType, gameId: string, modeCode: string): Promise<string | null> {
  const { data: mode, error } = await supabase
    .from("game_modes")
    .select("id")
    .eq("game_id", gameId)
    .eq("code", modeCode)
    .maybeSingle();

  if (error) {
    throw new DatabaseError(`Mode fetch failed: ${error.message}`);
  }

  if (!mode) {
    throw new NotFoundError(`Game mode "${modeCode}"`);
  }

  return mode.id;
}

/**
 * Inserts the game session into database
 */
async function insertGameSession(supabase: SupabaseType, sessionData: GameSessionInsert) {
  const { data, error } = await supabase
    .from("game_sessions")
    .insert(sessionData)
    .select("id")
    .single();

  if (error) {
    throw new DatabaseError(`Failed to save game result: ${error.message}`);
  }

  return data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return createErrorResponse("Server configuration error", 500);
    }

    // Authenticate user first to get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("Missing Authorization header", 401);
    }

    // Create Supabase client with global Authorization header (recommended approach)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const user = await authenticateUser(supabase);

    // Parse and validate request body
    const body: GameResultRequest = await req.json();
    const validation = validateRequest(body);

    if (!validation.isValid) {
      throw new ValidationError(validation.error!);
    }

    const { game_code, mode_code, metric_type, metric_value, extra_data = {} } = body;

    // Anti-cheat validation
    const antiCheatValidation = validateAntiCheat(metric_type, metric_value);
    if (!antiCheatValidation.isValid) {
      throw new ValidationError(antiCheatValidation.error!);
    }

    // Fetch game
    const game = await fetchGame(supabase, game_code);

    // Fetch mode (optional)
    let modeId: string | null = null;
    if (mode_code) {
      modeId = await fetchGameMode(supabase, game.id, mode_code);
    }

    // Prepare session data
    const sessionData: GameSessionInsert = {
      user_id: user.id,
      game_id: game.id,
      mode_id: modeId,
      metric_type,
      metric_value,
      extra_data,
      rewarded: false // Track reward status for future processing
    };

    // Insert game session
    const insertedSession = await insertGameSession(supabase, sessionData);

    // Return success response with session_id for frontend to call calc_reward_tx
    return createSuccessResponse({
      session_id: insertedSession.id,
      game_code,
      metric_type,
      metric_value,
      message: "Game result submitted successfully"
    });

  } catch (err) {
    console.error('Unexpected error:', err);

    // Handle specific error types with instanceof checks
    if (err instanceof AuthError) {
      return createErrorResponse("Authentication failed", 401);
    }

    if (err instanceof NotFoundError) {
      return createErrorResponse(err.message, 404);
    }

    if (err instanceof ValidationError) {
      return createErrorResponse(err.message, 400);
    }

    if (err instanceof DatabaseError) {
      return createErrorResponse("Database operation failed", 500, { details: err.message });
    }

    // Generic error fallback
    return createErrorResponse("Unexpected server error", 500);
  }
});