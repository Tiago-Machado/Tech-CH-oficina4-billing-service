import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Orcamento, StatusOrcamento } from '../../infrastructure/database/schemas/orcamento.schema';
import { MercadoPagoService } from '../../infrastructure/mercadopago.service';
import { MessagingService } from '../../infrastructure/messaging/messaging.service';
import { BILLING_EVENTS } from '../../domain/events/saga.events';
import { OsCriadaEvent, ExecucaoFinalizadaEvent } from '../../domain/events/saga.events';

@Injectable()
export class BillingUseCases {
  private readonly logger = new Logger(BillingUseCases.name);

  constructor(
    @InjectModel(Orcamento.name) private readonly orcamentoModel: Model<Orcamento>,
    private readonly mpService: MercadoPagoService,
    private readonly messaging: MessagingService,
  ) {}

  // Saga: OS criada → gerar orçamento automaticamente
  async gerarOrcamento(evento: OsCriadaEvent): Promise<void> {
    const valor = this.calcularValorEstimado(evento.descricaoProblema);
    const descricao = `Diagnóstico e reparo: ${evento.descricaoProblema}`;

    const orcamento = new this.orcamentoModel({
      osId: evento.osId,
      clienteNome: evento.clienteNome,
      clienteCpf: evento.clienteCpf,
      veiculoModelo: evento.veiculoModelo,
      descricaoServicos: descricao,
      valor,
      status: StatusOrcamento.AGUARDANDO_APROVACAO,
    });

    await orcamento.save();
    this.logger.log(`Orçamento gerado para OS ${evento.osId}: R$ ${valor}`);

    // Publica evento para OS Service atualizar status
    await this.messaging.publicar(BILLING_EVENTS.ORCAMENTO_GERADO, {
      osId: evento.osId,
      valorOrcamento: valor,
      descricaoServicos: descricao,
    });
  }

  // Saga: OS aprovada → processar pagamento via Mercado Pago
  async processarPagamento(osId: string): Promise<{ checkoutUrl: string }> {
    const orcamento = await this.orcamentoModel.findOne({ osId });
    if (!orcamento) throw new NotFoundException(`Orçamento para OS ${osId} não encontrado`);

    try {
      const { preferenceId, checkoutUrl } = await this.mpService.criarPreferencia({
        osId,
        descricao: orcamento.descricaoServicos,
        valor: orcamento.valor,
        clienteNome: orcamento.clienteNome,
      });

      orcamento.mpPreferenceId = preferenceId;
      orcamento.mpCheckoutUrl = checkoutUrl;
      orcamento.status = StatusOrcamento.APROVADO;
      await orcamento.save();

      this.logger.log(`Link de pagamento gerado para OS ${osId}`);
      return { checkoutUrl };
    } catch (err) {
      orcamento.status = StatusOrcamento.FALHOU;
      orcamento.motivoCancelamento = 'Falha ao criar preferência no Mercado Pago';
      await orcamento.save();

      // Compensação: notifica falha
      await this.messaging.publicar(BILLING_EVENTS.PAGAMENTO_FALHOU, {
        osId,
        motivo: 'Falha ao processar pagamento',
      });
      throw err;
    }
  }

  // Webhook do Mercado Pago → pagamento confirmado
  async confirmarPagamento(osId: string, paymentId: string): Promise<void> {
    const orcamento = await this.orcamentoModel.findOne({ osId });
    if (!orcamento) return;

    orcamento.status = StatusOrcamento.PAGO;
    orcamento.mpPaymentId = paymentId;
    await orcamento.save();

    await this.messaging.publicar(BILLING_EVENTS.PAGAMENTO_CONFIRMADO, {
      osId,
      transacaoId: paymentId,
      valor: orcamento.valor,
    });

    this.logger.log(`Pagamento confirmado para OS ${osId}`);
  }

  async buscarPorOsId(osId: string): Promise<Orcamento> {
    const orcamento = await this.orcamentoModel.findOne({ osId });
    if (!orcamento) throw new NotFoundException(`Orçamento para OS ${osId} não encontrado`);
    return orcamento;
  }

  async listarTodos(): Promise<Orcamento[]> {
    return this.orcamentoModel.find().sort({ createdAt: -1 });
  }

  // Compensação: cancelar orçamento se OS for cancelada
  async cancelarOrcamento(osId: string, motivo: string): Promise<void> {
    await this.orcamentoModel.updateOne(
      { osId },
      { status: StatusOrcamento.REJEITADO, motivoCancelamento: motivo },
    );
    this.logger.warn(`Orçamento cancelado para OS ${osId}: ${motivo}`);
  }

  private calcularValorEstimado(descricao: string): number {
    // Simulação simples de cálculo — em produção viria de tabela de serviços
    const base = 150;
    const adicional = descricao.length * 2;
    return Math.min(base + adicional, 2000);
  }
}
