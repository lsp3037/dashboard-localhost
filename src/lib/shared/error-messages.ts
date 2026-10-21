/** Mensagens em pt-BR para os códigos do envelope de erro (§6.9). */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  PATH_NOT_ALLOWED: 'O caminho está fora das raízes monitoradas.',
  NOT_FOUND: 'Caminho não encontrado no disco.',
  ALREADY_EXISTS: 'Este caminho já está cadastrado no hub.',
  INVALID_BODY: 'Verifique os campos destacados.',
  NOT_A_PROJECT: 'A pasta precisa conter package.json ou .git.',
  SCRIPT_NOT_ALLOWED: 'Este script não está na allowlist de execução.',
  NO_SCRIPT: 'Nenhum script dev/start/preview no package.json.',
  ALREADY_RUNNING: 'Este projeto já está rodando.',
  NOT_RUNNING: 'Nenhum processo ativo para este projeto.',
  PORT_IN_USE: 'A porta está ocupada por outro processo. O hub não mata processos que não iniciou.',
  SPAWN_FAILED: 'Falha ao iniciar o processo. Veja o terminal do hub.',
  KILL_FAILED: 'Não foi possível encerrar o processo. Verifique manualmente no Gerenciador de Tarefas.',
  PROJECT_MISSING: 'A pasta do projeto não foi encontrada no disco.',
  PROJECT_NOT_FOUND: 'Projeto não encontrado no inventário.',
  RUN_NOT_FOUND: 'Execução não encontrada.',
  MAX_RUNNING: 'Limite de execuções simultâneas atingido. Pare outro projeto antes.',
  RUNNING: 'Projeto com execução ativa. Pare antes de remover.',
  SCAN_FAILED: 'A varredura falhou.',
  INTERNAL_ERROR: 'Erro interno do hub. Veja o terminal.',
};

export function errorMessageFor(code: string, fallback: string): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
