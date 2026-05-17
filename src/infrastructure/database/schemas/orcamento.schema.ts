import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum StatusOrcamento {
  PENDENTE = 'PENDENTE',
  AGUARDANDO_APROVACAO = 'AGUARDANDO_APROVACAO',
  APROVADO = 'APROVADO',
  REJEITADO = 'REJEITADO',
  PAGO = 'PAGO',
  FALHOU = 'FALHOU',
}

@Schema({ timestamps: true, collection: 'orcamentos' })
export class Orcamento extends Document {
  @Prop({ required: true, unique: true })
  osId: string;

  @Prop({ required: true })
  clienteNome: string;

  @Prop({ required: true })
  clienteCpf: string;

  @Prop({ required: true })
  veiculoModelo: string;

  @Prop({ required: true })
  descricaoServicos: string;

  @Prop({ required: true, type: Number })
  valor: number;

  @Prop({ type: String, enum: StatusOrcamento, default: StatusOrcamento.PENDENTE })
  status: StatusOrcamento;

  @Prop({ type: String, nullable: true })
  mpPreferenceId?: string;

  @Prop({ type: String, nullable: true })
  mpPaymentId?: string;

  @Prop({ type: String, nullable: true })
  mpCheckoutUrl?: string;

  @Prop({ type: String, nullable: true })
  motivoCancelamento?: string;
}

export const OrcamentoSchema = SchemaFactory.createForClass(Orcamento);
