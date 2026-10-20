import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: parseInt(process.env.PORT || '3001', 10),

  // Gemini UX Analysis Models
  geminiEnabled: process.env.GEMINI_ENABLED !== 'false',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  geminiFallback1: process.env.GEMINI_FALLBACK_MODEL_1 || 'gemini-3.5-flash-lite',
  geminiFallback2: process.env.GEMINI_FALLBACK_MODEL_2 || 'gemini-3.1-flash-lite',

  // Gemma / Ask Veylora Models
  gemmaEnabled: process.env.GEMMA_ENABLED !== 'false',
  askVeyloraModel: process.env.ASK_VEYLORA_MODEL || 'gemma-4-31b-it',
  askVeyloraFallback1: process.env.ASK_VEYLORA_FALLBACK_MODEL_1 || 'gemini-3.5-flash-lite',
  askVeyloraFallback2: process.env.ASK_VEYLORA_FALLBACK_MODEL_2 || 'gemini-3.1-flash-lite',

  // API Key (backend only, never sent to frontend)
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // Usage Limits
  geminiDailyRequestLimit: parseInt(process.env.GEMINI_DAILY_REQUEST_LIMIT || '10', 10),
  geminiDailyWindowHours: parseInt(process.env.GEMINI_DAILY_WINDOW_HOURS || '24', 10),
  geminiMaxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '2048', 10),
  geminiRequestTimeoutMs: parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS || '60000', 10),
  geminiMaxConcurrency: parseInt(process.env.GEMINI_MAX_CONCURRENCY || '2', 10),

  askVeyloraDailyRequestLimit: parseInt(process.env.ASK_VEYLORA_DAILY_REQUEST_LIMIT || '10', 10),
  askVeyloraDailyWindowHours: parseInt(process.env.ASK_VEYLORA_DAILY_WINDOW_HOURS || '24', 10),
  askVeyloraMaxOutputTokens: parseInt(process.env.ASK_VEYLORA_MAX_OUTPUT_TOKENS || '1200', 10),
  askVeyloraRequestTimeoutMs: parseInt(process.env.ASK_VEYLORA_REQUEST_TIMEOUT_MS || '30000', 10),
  askVeyloraChatHistoryTtlDays: parseInt(process.env.ASK_VEYLORA_CHAT_HISTORY_TTL_DAYS || '7', 10),

  geminiAllowPaidUsage: process.env.GEMINI_ALLOW_PAID_USAGE === 'true',

  // File Paths
  dataDir: path.resolve(__dirname, '../data'),
  dbPath: path.resolve(__dirname, '../data/veylora.sqlite'),
  artifactsDir: path.resolve(__dirname, '../data/artifacts'),
};
