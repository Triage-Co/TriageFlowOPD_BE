import { Module } from '@nestjs/common';
import { AuthModule } from './routes/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { InfermedicaModule } from './routes/infermedica/infermedica.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    SharedModule,
    InfermedicaModule],
})
export class AppModule { }
