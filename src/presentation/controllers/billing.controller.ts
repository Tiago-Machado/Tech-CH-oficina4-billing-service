import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BillingUseCases } from '../../application/use-cases/billing.use-cases';

@ApiTags('Billing')
@Controller('api/v1')
export class BillingController {
  constructor(private readonly useCases: BillingUseCases) {}

  @Get('orcamentos')
  @ApiOperation({ summary: 'Listar todos os orçamentos' })
  listar() {
    return this.useCases.listarTodos();
  }

  @Get('orcamentos/:osId')
  @ApiOperation({ summary: 'Buscar orçamento por OS ID' })
  buscar(@Param('osId') osId: string) {
    return this.useCases.buscarPorOsId(osId);
  }

  @Post('orcamentos/:osId/pagamento')
  @ApiOperation({ summary: 'Gerar link de pagamento Mercado Pago' })
  gerarPagamento(@Param('osId') osId: string) {
    return this.useCases.processarPagamento(osId);
  }

  @Post('pagamentos/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook Mercado Pago' })
  async webhook(@Body() body: any, @Query('topic') topic: string) {
    if (topic === 'payment' && body?.data?.id) {
      const osId = body?.additional_info?.external_reference ?? body?.data?.id;
      await this.useCases.confirmarPagamento(osId, String(body.data.id));
    }
    return { received: true };
  }

  @Get('pagamentos/sucesso')
  sucesso(@Query('external_reference') osId: string) {
    return { message: 'Pagamento realizado com sucesso', osId };
  }

  @Get('pagamentos/falha')
  falha(@Query('external_reference') osId: string) {
    return { message: 'Pagamento falhou', osId };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'billing-service', timestamp: new Date() };
  }
}
