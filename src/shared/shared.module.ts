import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseConfig } from './config/supabase.config';
import { PrismaConfig } from './config/prisma.config';
import { PayosConfig } from './config/payos.config';
import { GeoService } from './geo/geo.service';

@Global()
@Module({
  providers: [
    ConfigService,
    SupabaseConfig,
    PrismaConfig,
    PayosConfig,
    GeoService,
  ],
  exports: [SupabaseConfig, PrismaConfig, PayosConfig, GeoService],
})
export class SharedModule {}
