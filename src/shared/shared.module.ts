import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfig } from './config/supabase.config';
import { PrismaConfig } from './config/prisma.config';

@Global()
@Module({
    providers: [ConfigService, SupabaseConfig, PrismaConfig],
    exports: [SupabaseConfig, PrismaConfig]
})
export class SharedModule { }
