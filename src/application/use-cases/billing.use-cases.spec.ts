import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { BillingUseCases } from './billing.use-cases';
import { Orcamento, StatusOrcamento } from '../../infrastructure/database/schemas/orcamento.schema';
import { MercadoPagoService } from '../../infrastructure/mercadopago.service';
import { MessagingService } from '../../infrastructure/messaging/messaging.service';

const mockOrcamentoModel = {
  findOne: jest.fn(),
  updateOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
};

function MockOrcamentoModel(data: any) {
  return { ...data, save: jest.fn().mockResolvedValue({ ...data, _id: 'mongo-id' }) };
}
MockOrcamentoModel.findOne = jest.fn();
MockOrcamentoModel.find = jest.fn();
MockOrcamentoModel.updateOne = jest.fn();

const mockMpService = { criarPreferencia: jest.fn() };
const mockMessaging = { publicar: jest.fn() };

describe('BillingUseCases', () => {
  let useCases: BillingUseCases;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingUseCases,
        { provide: getModelToken(Orcamento.name), useValue: MockOrcamentoModel },
        { provide: MercadoPagoService, useValue: mockMpService },
        { provide: MessagingService, useValue: mockMessaging },
      ],
    }).compile();

    useCases = module.get<BillingUseCases>(BillingUseCases);
    jest.clearAllMocks();
  });

  describe('gerarOrcamento()', () => {
    it('deve criar orçamento e publicar evento orcamento.gerado', async () => {
      const evento = {
        osId: 'uuid-1', clienteNome: 'João', clienteCpf: '12345678900',
        veiculoPlaca: 'ABC1D23', veiculoModelo: 'Civic',
        descricaoProblema: 'Barulho no motor', criadoEm: new Date(),
      };
      mockMessaging.publicar.mockResolvedValue(undefined);

      await useCases.gerarOrcamento(evento);

      expect(mockMessaging.publicar).toHaveBeenCalledWith(
        'orcamento.gerado',
        expect.objectContaining({ osId: 'uuid-1' })
      );
    });
  });

  describe('buscarPorOsId()', () => {
    it('deve retornar orçamento existente', async () => {
      const orcamento = { osId: 'uuid-1', valor: 500, status: StatusOrcamento.AGUARDANDO_APROVACAO };
      MockOrcamentoModel.findOne.mockResolvedValue(orcamento);

      const result = await useCases.buscarPorOsId('uuid-1');
      expect(result.osId).toBe('uuid-1');
    });

    it('deve lançar NotFoundException se não encontrar', async () => {
      MockOrcamentoModel.findOne.mockResolvedValue(null);
      await expect(useCases.buscarPorOsId('nao-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listarTodos()', () => {
    it('deve retornar lista de orçamentos', async () => {
      MockOrcamentoModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([{ osId: 'uuid-1' }, { osId: 'uuid-2' }]),
      });

      const result = await useCases.listarTodos();
      expect(result).toHaveLength(2);
    });
  });

  describe('cancelarOrcamento()', () => {
    it('deve cancelar orçamento com motivo', async () => {
      MockOrcamentoModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      await useCases.cancelarOrcamento('uuid-1', 'OS cancelada');

      expect(MockOrcamentoModel.updateOne).toHaveBeenCalledWith(
        { osId: 'uuid-1' },
        expect.objectContaining({ status: StatusOrcamento.REJEITADO })
      );
    });
  });

  describe('processarPagamento()', () => {
    it('deve lançar NotFoundException se orçamento não existir', async () => {
      MockOrcamentoModel.findOne.mockResolvedValue(null);
      await expect(useCases.processarPagamento('nao-existe')).rejects.toThrow(NotFoundException);
    });

    it('deve publicar pagamento.falhou se MP falhar', async () => {
      const orcamento = {
        osId: 'uuid-1', valor: 500, status: StatusOrcamento.AGUARDANDO_APROVACAO,
        clienteNome: 'João', descricaoServicos: 'Reparo',
        save: jest.fn().mockResolvedValue(undefined),
      };
      MockOrcamentoModel.findOne.mockResolvedValue(orcamento);
      mockMpService.criarPreferencia.mockRejectedValue(new Error('MP erro'));
      mockMessaging.publicar.mockResolvedValue(undefined);

      await expect(useCases.processarPagamento('uuid-1')).rejects.toThrow();
      expect(mockMessaging.publicar).toHaveBeenCalledWith(
        'pagamento.falhou',
        expect.objectContaining({ osId: 'uuid-1' })
      );
    });
  });
});

describe('BillingUseCases — fluxos adicionais', () => {
  let useCases: BillingUseCases;

  beforeEach(async () => {
    const { Test } = require('@nestjs/testing');
    const module = await Test.createTestingModule({
      providers: [
        BillingUseCases,
        { provide: require('@nestjs/mongoose').getModelToken(Orcamento.name), useValue: MockOrcamentoModel },
        { provide: MercadoPagoService, useValue: mockMpService },
        { provide: MessagingService, useValue: mockMessaging },
      ],
    }).compile();
    useCases = module.get(BillingUseCases);
    jest.clearAllMocks();
  });

  it('processarPagamento() deve gerar link e salvar preferenceId', async () => {
    const orcamento = {
      osId: 'uuid-1', valor: 500, status: StatusOrcamento.AGUARDANDO_APROVACAO,
      clienteNome: 'João', descricaoServicos: 'Reparo',
      save: jest.fn().mockResolvedValue(undefined),
    };
    MockOrcamentoModel.findOne.mockResolvedValue(orcamento);
    mockMpService.criarPreferencia.mockResolvedValue({
      preferenceId: 'pref-123',
      checkoutUrl: 'https://sandbox.mp.com/checkout',
    });

    const result = await useCases.processarPagamento('uuid-1');
    expect(result.checkoutUrl).toContain('sandbox.mp.com');
    expect(orcamento.save).toHaveBeenCalled();
  });

  it('confirmarPagamento() deve atualizar status para PAGO e publicar evento', async () => {
    const orcamento = {
      osId: 'uuid-1', valor: 500,
      status: StatusOrcamento.APROVADO,
      save: jest.fn().mockResolvedValue(undefined),
    };
    MockOrcamentoModel.findOne.mockResolvedValue(orcamento);
    mockMessaging.publicar.mockResolvedValue(undefined);

    await useCases.confirmarPagamento('uuid-1', 'pay-123');

    expect(orcamento.status).toBe(StatusOrcamento.PAGO);
    expect(mockMessaging.publicar).toHaveBeenCalledWith(
      'pagamento.confirmado',
      expect.objectContaining({ osId: 'uuid-1', transacaoId: 'pay-123' })
    );
  });

  it('confirmarPagamento() deve ignorar se orçamento não existir', async () => {
    MockOrcamentoModel.findOne.mockResolvedValue(null);
    await expect(useCases.confirmarPagamento('nao-existe', 'pay-1')).resolves.not.toThrow();
  });
});
