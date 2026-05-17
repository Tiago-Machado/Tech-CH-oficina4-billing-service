import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Orcamento, OrcamentoSchema } from './infrastructure/database/schemas/orcamento.schema';
import { MessagingService } from './infrastructure/messaging/messaging.service';
import { SagaConsumer } from './infrastructure/messaging/saga.consumer';
import { MercadoPagoService } from './infrastructure/mercadopago.service';
import { BillingUseCases } from './application/use-cases/billing.use-cases';
import { BillingController } from './presentation/controllers/billing.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
      }),
    }),
    MongooseModule.forFeature([{ name: Orcamento.name, schema: OrcamentoSchema }]),
  ],
  controllers: [BillingController],
  providers: [MessagingService, SagaConsumer, MercadoPagoService, BillingUseCases],
})
export class AppModule {}
