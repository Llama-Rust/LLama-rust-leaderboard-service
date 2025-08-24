import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT || 8080),
  RCON_HOST: process.env.RCON_HOST || '',
  RCON_PORT: Number(process.env.RCON_PORT || 0),
  RCON_PASSWORD: process.env.RCON_PASSWORD || '',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || ''
};

