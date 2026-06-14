import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfig } from './config/supabase.config';
import { PrismaConfig } from './config/prisma.config';
import { PayosConfig } from './config/payos.config';

@Global()
@Module({
    providers: [ConfigService, SupabaseConfig, PrismaConfig, PayosConfig],
    exports: [SupabaseConfig, PrismaConfig, PayosConfig]
})
export class SharedModule { }
