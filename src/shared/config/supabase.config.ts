import { createClient, SupabaseClient } from '@supabase/supabase-js';
import envInstance from './env.config';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseConfig {
  private readonly supabase: SupabaseClient;
  constructor(private readonly configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ??
      envInstance.SUPABASE_URL;
    const supabaseKey =
      this.configService.get<string>('DATABASE_KEY') ??
      envInstance.SUPABASE_KEY;
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
