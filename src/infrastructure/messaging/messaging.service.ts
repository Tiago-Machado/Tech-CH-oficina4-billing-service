import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchange = 'oficina.events';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.conectar();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (_) {}
  }

  private async conectar(): Promise<void> {
    try {
      const url = this.config.get<string>('RABBITMQ_URL') ?? 'amqp://localhost';
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
      this.logger.log('RabbitMQ conectado');
    } catch (err) {
      this.logger.error('Falha ao conectar RabbitMQ', err);
      setTimeout(() => this.conectar(), 5000);
    }
  }

  async publicar(routingKey: string, payload: object): Promise<void> {
    try {
      const msg = Buffer.from(JSON.stringify(payload));
      this.channel!.publish(this.exchange, routingKey, msg, { persistent: true });
      this.logger.log(`Evento publicado: ${routingKey}`);
    } catch (err) {
      this.logger.error(`Falha ao publicar evento ${routingKey}`, err);
    }
  }

  async assinar(
    queue: string,
    routingKey: string,
    handler: (msg: any) => Promise<void>,
  ): Promise<void> {
    await this.channel!.assertQueue(queue, { durable: true });
    await this.channel!.bindQueue(queue, this.exchange, routingKey);
    await this.channel!.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await handler(payload);
        this.channel!.ack(msg);
      } catch (err) {
        this.logger.error(`Erro ao processar fila ${queue}`, err);
        this.channel!.nack(msg, false, false);
      }
    });
    this.logger.log(`Assinando fila: ${queue} (${routingKey})`);
  }
}
