/** Mensagens em pt-BR para os códigos do envelope de erro (§6.9). */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  PATH_NOT_ALLOWED: 'O caminho está fora das raízes monitoradas.',
  NOT_FOUND: 'Caminho não encontrado no disco.',
  ALREADY_EXISTS: 'Este caminho já está cadastrado no hub.',
  INVALID_BODY: 'Verifique os campos destacados.',
  NOT_A_PROJECT: 'A pasta precisa conter package.json ou .git.',
  SCRIPT_NOT_ALLOWED: 'Este script não está na allowlist de execução.',
  SCAN_FAILED: 'A varredura falhou.',
  INTERNAL_ERROR: 'Erro interno do hub. Veja o terminal.',
};

export function errorMessageFor(code: string, fallback: string): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
