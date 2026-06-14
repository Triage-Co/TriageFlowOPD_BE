import { Module } from '@nestjs/common';
import { AuthModule } from './routes/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { InfermedicaModule } from './routes/infermedica/infermedica.module';
import { PaymentModule } from './routes/payment/payment.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    SharedModule,
    InfermedicaModule,
    PaymentModule],
})
export class AppModule { }
