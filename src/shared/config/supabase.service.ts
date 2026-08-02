import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import envInstance from './env.config';

@Injectable()
export class SupabaseService {
  supabaseClient: SupabaseClient;

  constructor() {
    const SUPABASE_URL = envInstance.SUPABASE_URL;
    const SUPABASE_KEY = envInstance.SUPABASE_KEY;

    this.supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  getClient() {
    return this.supabaseClient;
  }
}
