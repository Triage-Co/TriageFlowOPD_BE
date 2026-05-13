import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfig } from './config/supabase.config';

@Global()
@Module({
    providers: [ConfigService, SupabaseConfig],
    exports: [SupabaseConfig]
})
export class SharedModule { }
