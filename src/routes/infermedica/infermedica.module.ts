import { Module } from '@nestjs/common';
import { InfermedicaService } from './infermedica.service';
import { InfermedicaController } from './infermedica.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { AiSpecialtyModule } from '../ai-specialty/ai-specialty.module';

@Module({
  controllers: [InfermedicaController],
  providers: [InfermedicaService],
  imports: [
    AiSpecialtyModule,
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: 'https://api.infermedica.com/v3',
        headers: {
          'App-Id': config.get<string>('INFERMEDICA_APP_ID'),
          'App-Key': config.get<string>('INFERMEDICA_APP_KEY'),
          'Content-Type': 'application/json',
        },
      }),
    }),
    CacheModule.register(),
  ],
})
export class InfermedicaModule {}
