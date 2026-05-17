import { Test, TestingModule } from '@nestjs/testing';
import { BillingController } from './billing.controller';
import { BillingUseCases } from '../../application/use-cases/billing.use-cases';

const mockUseCases = {
  listarTodos: jest.fn(),
  buscarPorOsId: jest.fn(),
  processarPagamento: jest.fn(),
  confirmarPagamento: jest.fn(),
  cancelarOrcamento: jest.fn(),
};

describe('BillingController', () => {
  let controller: BillingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [{ provide: BillingUseCases, useValue: mockUseCases }],
    }).compile();

    controller = module.get<BillingController>(BillingController);
    jest.clearAllMocks();
  });

  it('health() deve retornar status ok', () => {
    const result = controller.health();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('billing-service');
  });

  it('listar() deve chamar listarTodos', async () => {
    mockUseCases.listarTodos.mockResolvedValue([{ osId: 'uuid-1' }]);
    const result = await controller.listar();
    expect(result).toHaveLength(1);
  });

  it('buscar() deve chamar buscarPorOsId', async () => {
    mockUseCases.buscarPorOsId.mockResolvedValue({ osId: 'uuid-1' });
    const result = await controller.buscar('uuid-1');
    expect(result.osId).toBe('uuid-1');
  });

  it('gerarPagamento() deve retornar checkoutUrl', async () => {
    mockUseCases.processarPagamento.mockResolvedValue({ checkoutUrl: 'https://mp.com/checkout' });
    const result = await controller.gerarPagamento('uuid-1');
    expect(result.checkoutUrl).toContain('mp.com');
  });

  it('webhook() deve confirmar pagamento quando topic=payment', async () => {
    mockUseCases.confirmarPagamento.mockResolvedValue(undefined);
    const body = { data: { id: 'pay-123' }, additional_info: { external_reference: 'uuid-1' } };
    const result = await controller.webhook(body, 'payment');
    expect(mockUseCases.confirmarPagamento).toHaveBeenCalled();
    expect(result.received).toBe(true);
  });

  it('webhook() deve ignorar topic diferente de payment', async () => {
    const result = await controller.webhook({}, 'merchant_order');
    expect(mockUseCases.confirmarPagamento).not.toHaveBeenCalled();
    expect(result.received).toBe(true);
  });

  it('sucesso() deve retornar mensagem de sucesso', () => {
    const result = controller.sucesso('uuid-1');
    expect(result.message).toContain('sucesso');
    expect(result.osId).toBe('uuid-1');
  });

  it('falha() deve retornar mensagem de falha', () => {
    const result = controller.falha('uuid-1');
    expect(result.message).toContain('falhou');
  });
});
