import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { BillingUseCases } from '../../application/use-cases/billing.use-cases';
import { OS_EVENTS, EXECUCAO_EVENTS, OsCriadaEvent, ExecucaoFinalizadaEvent } from '../../domain/events/saga.events';

@Injectable()
export class SagaConsumer implements OnModuleInit {
  private readonly logger = new Logger(SagaConsumer.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly useCases: BillingUseCases,
  ) {}

  async onModuleInit(): Promise<void> {
    await new Promise((r) => setTimeout(r, 3000));
    await this.registrarConsumers();
  }

  private async registrarConsumers(): Promise<void> {
    // OS criada → gerar orçamento
    await this.messaging.assinar(
      'billing-service.os.criada',
      OS_EVENTS.OS_CRIADA,
      async (payload: OsCriadaEvent) => {
        this.logger.log(`OS criada recebida: ${payload.osId}`);
        await this.useCases.gerarOrcamento(payload);
      },
    );

    // OS aprovada → processar pagamento
    await this.messaging.assinar(
      'billing-service.os.aprovada',
      OS_EVENTS.OS_APROVADA,
      async (payload: { osId: string }) => {
        this.logger.log(`OS aprovada, processando pagamento: ${payload.osId}`);
        await this.useCases.processarPagamento(payload.osId);
      },
    );

    // OS cancelada → cancelar orçamento (compensação)
    await this.messaging.assinar(
      'billing-service.os.cancelada',
      OS_EVENTS.OS_CANCELADA,
      async (payload: { osId: string; motivo: string }) => {
        this.logger.warn(`OS cancelada, revertendo orçamento: ${payload.osId}`);
        await this.useCases.cancelarOrcamento(payload.osId, payload.motivo);
      },
    );

    // Execução finalizada → confirmar pagamento
    await this.messaging.assinar(
      'billing-service.execucao.finalizada',
      EXECUCAO_EVENTS.EXECUCAO_FINALIZADA,
      async (payload: ExecucaoFinalizadaEvent) => {
        this.logger.log(`Execução finalizada para OS ${payload.osId}`);
      },
    );
  }
}
