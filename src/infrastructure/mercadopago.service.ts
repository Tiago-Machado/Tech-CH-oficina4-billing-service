import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MercadoPagoConfig, { Preference } from 'mercadopago';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly client: MercadoPagoConfig;

  constructor(private readonly config: ConfigService) {
    this.client = new MercadoPagoConfig({
      accessToken: this.config.get<string>('MP_ACCESS_TOKEN') ?? '',
    });
  }

  async criarPreferencia(dados: {
    osId: string;
    descricao: string;
    valor: number;
    clienteNome: string;
    clienteEmail?: string;
  }): Promise<{ preferenceId: string; checkoutUrl: string }> {
    try {
      const preference = new Preference(this.client);
      const response = await preference.create({
        body: {
          external_reference: dados.osId,
          items: [
            {
              id: dados.osId,
              title: `Oficina Mecânica - OS ${dados.osId}`,
              description: dados.descricao,
              quantity: 1,
              unit_price: dados.valor,
              currency_id: 'BRL',
            },
          ],
          payer: {
            name: dados.clienteNome,
            email: dados.clienteEmail ?? 'cliente@oficina.com',
          },
          back_urls: {
            success: 'http://localhost:3002/api/v1/pagamentos/sucesso',
            failure: 'http://localhost:3002/api/v1/pagamentos/falha',
            pending: 'http://localhost:3002/api/v1/pagamentos/pendente',
          },
          auto_return: 'approved',
          notification_url: 'http://localhost:3002/api/v1/pagamentos/webhook',
        },
      });

      this.logger.log(`Preferência MP criada: ${response.id} para OS ${dados.osId}`);

      return {
        preferenceId: response.id ?? '',
        checkoutUrl: response.sandbox_init_point ?? response.init_point ?? '',
      };
    } catch (err) {
      this.logger.error('Erro ao criar preferência MP', err);
      throw err;
    }
  }
}
