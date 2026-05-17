export const OS_EVENTS = {
  OS_CRIADA: 'os.criada',
  OS_APROVADA: 'os.aprovada',
  OS_CANCELADA: 'os.cancelada',
} as const;

export const BILLING_EVENTS = {
  ORCAMENTO_GERADO: 'orcamento.gerado',
  PAGAMENTO_CONFIRMADO: 'pagamento.confirmado',
  PAGAMENTO_FALHOU: 'pagamento.falhou',
} as const;

export const EXECUCAO_EVENTS = {
  EXECUCAO_FINALIZADA: 'execucao.finalizada',
} as const;

export interface OsCriadaEvent {
  osId: string;
  clienteNome: string;
  clienteCpf: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  descricaoProblema: string;
  criadoEm: Date;
}

export interface OsAprovadaEvent {
  osId: string;
}

export interface ExecucaoFinalizadaEvent {
  osId: string;
  tecnicoResponsavel: string;
  observacoes?: string;
}
