# PRD — Hub Local

| Campo | Valor |
|---|---|
| Produto | Hub Local (`dashboard-localhost`) |
| Versão | `0.1.0` |
| Status | MVP parcial — F0–F3 implementadas; F4–F5 pendentes |
| Responsável | `lsp3037` |
| Última atualização | 21/10/2026 |
| Especificação técnica | [`../dashboard-localhost.md`](../dashboard-localhost.md) |
| README | [`../README.md`](../README.md) |

## 1. Resumo

O Hub Local é uma aplicação web que roda na máquina do desenvolvedor e responde três perguntas em uma única tela:

1. **O que eu tenho?** — inventário dos projetos locais.
2. **O que está rodando?** — status, porta, PID e uptime.
3. **Como subo ou derrubo isso?** — start/stop de scripts permitidos, com histórico de execuções.

O produto é intencionalmente local: sem cadastro, sem nuvem, sem autenticação e sem exposição na rede. O foco é reduzir o atrito de alternar entre terminais, portas e projetos no Windows.

## 2. Problema

Quem mantém muitos projetos locais no Windows costuma enfrentar:

- pastas esquecidas e projetos sem documentação de como iniciar;
- portas diferentes espalhadas por scripts (`3000`, `3002`, `3007`, `5173` etc.);
- dev servers antigos ainda ocupando portas;
- dificuldade de saber qual projeto está rodando e qual foi o último erro;
- monorepos em que o comando certo está dentro de `apps/*` ou `packages/*`;
- risco de matar o processo errado ao tentar liberar uma porta.

O Hub Local centraliza inventário e operação sem substituir o terminal, o Git ou o editor.

## 3. Público-alvo

**Persona principal:** desenvolvedor solo no Windows, com vários projetos e monorepos na mesma máquina, que alterna entre eles durante o dia.

**Contexto de uso:** máquina de desenvolvimento, acesso apenas por `localhost`, um usuário por vez.

**Fora do público-alvo:** times, ambientes compartilhados, produção, servidores remotos e usuários que precisam de autenticação ou auditoria multiusuário.

## 4. Objetivos

### 4.1 Objetivos do produto

- Dar visibilidade confiável do inventário local.
- Permitir iniciar e parar projetos sem digitar comandos.
- Mostrar a porta e o endereço clicável de cada projeto.
- Evitar execução arbitrária e kill de processos externos.
- Funcionar bem com monorepos e nomes de pasta com espaços/acentos.
- Manter o estado durável o suficiente para sobreviver a reloads e reinícios do hub.

### 4.2 Não-objetivos

- Autenticação, permissões, multiusuário.
- Exposição em LAN, túnel, HTTPS ou deploy em nuvem.
- Terminal livre, shell interativo ou comando customizado.
- Git write operations (commit, pull, push, checkout).
- Instalação de dependências, build ou testes de outros projetos.
- Docker, PM2, WSL, containers.
- Métricas de CPU/RAM e gráficos históricos.
- Edição de `package.json` ou de arquivos dos projetos.
- Aplicativo mobile ou PWA offline.

## 5. Escopo e status

Status possíveis: **Implementado**, **Parcial**, **Pendente**.

| ID | Requisito | Status | Observação |
|---|---|---|---|
| RF-01 | Escanear raízes configuradas e montar inventário | Implementado | Profundidade 1–2, com skip de `node_modules`, `.git`, builds e caches. |
| RF-02 | Detectar projetos Node e não-Node | Implementado | Projeto = pasta com `package.json` ou `.git`. |
| RF-03 | Detectar stack, package manager, scripts e branch | Implementado | Stack por dependências/arquivos; git via CLI com timeout. |
| RF-04 | Expandir workspaces/monorepos | Implementado | `pnpm-workspace.yaml` e `workspaces` do `package.json`; filhos recebem `parent_id`. |
| RF-05 | Cadastrar projeto manualmente por caminho | Implementado | Caminho precisa estar dentro das raízes permitidas. |
| RF-06 | Editar nome, notas, porta e script padrão | Implementado | Também permite ocultar e remover registro. |
| RF-07 | Buscar, filtrar e contar projetos | Implementado | Filtros Todos/Rodando/Ocultos e contadores no header. |
| RF-08 | Iniciar scripts permitidos | Implementado | `dev`, `start`, `preview`; package manager detectado. |
| RF-09 | Parar a árvore de processos do run | Implementado | `taskkill /T /F` após validar identidade do PID. |
| RF-10 | Exibir status, porta, PID e uptime | Implementado | Polling de 2 s enquanto há run ativo. |
| RF-11 | Detectar porta declarada ou emitida no log | Implementado | Script → log → árvore de PIDs. |
| RF-12 | Tratar porta ocupada sem matar o dono | Implementado | `409 PORT_IN_USE` com PID/dono. |
| RF-13 | Exibir os últimos runs | Implementado | 10 mais recentes no detalhe. |
| RF-14 | Incluir o próprio hub no inventário | Implementado | Badge `hub`, status `rodando`, start bloqueado com `409 RUNNING`. |
| RF-15 | Configurações somente leitura | Implementado | `/settings` lê ambiente e banco. |
| RF-16 | Health check | Implementado | `GET /api/health` verifica SQLite e retorna versão/raízes. |
| RF-17 | Logs ao vivo e SSE | Parcial | Ring buffer em memória existe; falta API, viewer e streaming. |
| RF-18 | Limpeza de histórico de runs | Pendente | Botão desabilitado em `/settings`. |
| RF-19 | Suíte E2E | Pendente | Script existe, configuração e cenários ainda não. |

## 6. Requisitos funcionais detalhados

### 6.1 Inventário e descoberta

- O scan deve varrer cada raiz de `HUB_PROJECTS_ROOTS` até a profundidade configurada.
- Pastas com `package.json` ou `.git` são candidatas; as demais podem aparecer como `non-node` na raiz.
- O scan não deve descer em `node_modules`, `.next`, `dist`, `build`, `coverage`, caches e diretórios ocultos.
- Nomes exibidos vêm da pasta, preservando espaços e acentos; `package.json.name` é metadado secundário.
- O scan deve ser idempotente: rodar duas vezes não duplica projetos.
- Campos editados pelo usuário (`hidden`, `notes`, `preferred_port`) não podem ser sobrescritos pelo scan.
- Projetos de scan que sumiram do disco viram `missing`, sem apagar o registro.
- Projetos manuais sobrevivem a novos scans.

**Critérios de aceite**

- [x] Segunda execução do scan retorna `added: 0` para os mesmos projetos.
- [x] Workspace pnpm agrupa `apps/*` e `packages/*` sob o pai.
- [x] Projeto com nome acentuado renderiza sem quebrar encoding.
- [x] Caminho fora da allowlist retorna `403 PATH_NOT_ALLOWED`.
- [x] Ocultar/editar um projeto persiste após reload e novo scan.

### 6.2 Operação de processos

- O cliente só pode enviar o nome de um script; nunca comando, argumento ou caminho de executável.
- O script precisa existir no `package.json` e estar na allowlist.
- O comando é montado no servidor conforme o package manager (`npm`, `pnpm`, `yarn`, `bun`).
- Um projeto só pode ter um run ativo por vez.
- O limite de runs simultâneos é `HUB_MAX_RUNNING` (default 4).
- Antes do spawn, o hub verifica se a porta alvo já está ocupada.
- Porta ocupada por processo externo retorna `409` e **não** mata o dono.
- O stop encerra a árvore do PID raiz e valida a identidade do PID antes de matar.
- O hub nunca mata processos que não iniciou.
- No shutdown do hub, runs ativas devem ser encerradas; no boot, runs órfãs são reconciliadas sem kill.

**Critérios de aceite**

- [x] Iniciar um projeto com `dev` deixa o status `running` e registra PID/porta.
- [x] Parar remove o listener e não deixa processo filho.
- [x] Segundo start no mesmo projeto retorna `409 ALREADY_RUNNING`.
- [x] Script fora da allowlist retorna `422`.
- [x] Listener decoy em porta alvo permanece vivo após `409 PORT_IN_USE`.
- [x] Reiniciar o hub não mata runs antigas; elas são reconciliadas.
- [ ] Validar shutdown por `Ctrl+C` com dois runs ativos e zero listeners órfãos.

### 6.3 Workspaces

- O workspace root é exibido como cabeçalho colapsável, não como card duplicado.
- Os pacotes filhos aparecem como cards independentes e indentados.
- Cada filho tem seus próprios scripts, porta, git e ações.
- O status do cabeçalho reflete o workspace root, não a soma dos filhos.
- O root sem `dev`/`start`/`preview` não é iniciável.

**Critérios de aceite**

- [x] `prenatal-saas` aparece como workspace com `api`, `db`, `ig-dpp` e `web`.
- [x] `web` mostra a porta `3007` declarada no script.
- [x] `db` e `ig-dpp` têm o botão Iniciar desabilitado por não terem script de aplicação.
- [x] Filhos sem `.git` próprio mostram `sem git`.

### 6.4 Observabilidade e configuração

- O detalhe do projeto deve mostrar estado, PID, porta, uptime, script, run ativo, branch, package manager e últimos 10 runs.
- O card deve mostrar status, stack, branch, porta clicável e última atividade/uptime.
- O header deve mostrar totais reais: total, rodando, parado, erro e oculto.
- `/settings` deve listar raízes, profundidade, allowlist, limites e caminho do SQLite.
- O health check deve falhar se o SQLite estiver indisponível.

**Critérios de aceite**

- [x] Contadores do header refletem runs ativos reais.
- [x] Porta é exibida como `http://localhost:<porta>` clicável.
- [x] O hub aparece como `rodando` e não pode ser iniciado/parado.
- [x] `GET /api/health` retorna `ok: true` com banco disponível.
- [ ] Logs ao vivo no detalhe (F4).
- [ ] Limpeza de histórico pela UI (F4/F5).

## 7. Requisitos não funcionais

### Segurança

- O hub escuta apenas em `localhost` e não tem autenticação; não deve ser exposto na rede.
- Allowlist obrigatória para raízes e scripts.
- `spawn` com `shell: false`; nenhum input do cliente entra na linha de comando.
- Kill restrito à árvore de PIDs do hub, com validação de `CreationDate`.
- DTOs e logs não devem expor variáveis de ambiente ou segredos.
- Remoção de projeto nunca toca nos arquivos do disco.

### Performance

- Scan de dezenas de projetos deve ficar abaixo de 2 s no caso comum, com timeout global de 10 s.
- Leitura de páginas deve ser local e sem cache entre requisições.
- Polling de status é de 2 s e só roda quando há run ativo.
- O ring buffer limita linhas por run; a F4 deve limitar também o arquivo de log.

### Confiabilidade

- Estado durável em SQLite com WAL, `busy_timeout` e transações curtas.
- Singleton em `globalThis` para sobreviver ao HMR do Next em desenvolvimento.
- Reconciliação no boot sem matar processos.
- Índice único parcial garante um run ativo por projeto.

### UX e acessibilidade

- Status nunca depende só de cor: usa dot + texto.
- Foco visível, `aria-live` no status, dialogs com foco preso e `Esc`.
- Layout responsivo, com densidade alta e tema escuro.
- Textos em pt-BR.

### Portabilidade

- Estado atual: **Windows apenas**, por causa de `cmd.exe`, `taskkill` e WMI.
- Node.js 20.9+.
- SQLite embutido, sem serviço externo.

### Manutenibilidade

- TypeScript strict, ESLint, Vitest e build de produção.
- Separação entre `lib/server`, `lib/shared` e componentes client.
- Rotas com contratos JSON testáveis.
- Documentação de produto e especificação técnica versionadas.

## 8. Fluxos principais

### 8.1 Primeiro uso

1. Usuário sobe o hub em `localhost:3100`.
2. O banco é criado/migrado em `.data/hub.db`.
3. Usuário clica em **Escanear**.
4. O scan popula o inventário.
5. Cards aparecem com status `parado` e portas conhecidas.

### 8.2 Dia a dia

1. Usuário busca ou filtra o projeto.
2. Clica em **Iniciar**.
3. O hub valida allowlist, porta e limite de runs.
4. O processo sobe e a porta é detectada.
5. O card atualiza para `rodando` com porta e uptime.
6. Usuário abre o endereço ou o detalhe.
7. Ao terminar, clica em **Parar**.

### 8.3 Workspace

1. O scan encontra o root do monorepo e os pacotes.
2. O root vira cabeçalho; os pacotes viram cards.
3. Usuário inicia apenas o pacote desejado (`web`, `api`).
4. Cada pacote mantém seu próprio run e porta.

### 8.4 Porta ocupada

1. Usuário tenta iniciar um projeto.
2. A porta alvo já tem listener externo.
3. O hub retorna `409 PORT_IN_USE` com PID e nome do processo.
4. O listener externo continua vivo.
5. Usuário decide trocar a porta ou encerrar o processo manualmente.

### 8.5 Queda ou reinício do hub

1. O hub cai ou é reiniciado.
2. No boot, runs do banco são reconciliadas.
3. Se o PID ainda é o mesmo, o run é adotado.
4. Caso contrário, vira `crashed`/`ORPHAN_RECONCILED`.
5. Nenhum processo é morto no boot.

## 9. Modelo de dados

### `projects`

Representa um projeto descoberto ou cadastrado manualmente.

Campos principais: `id`, `name`, `package_name`, `path`, `parent_id`, `source`, `kind`, `hidden`, `missing`, `stack`, `package_manager`, `scripts`, `default_script`, `preferred_port`, `git_branch`, `git_head_at`, `notes`, timestamps.

Regras:

- `path` é único.
- `parent_id` aponta para o workspace root.
- `hidden` é soft delete.
- `missing` indica pasta removida do disco.
- `preferred_port` é preenchido pelo script ou pelo usuário e não é sobrescrito pelo scan.

### `process_runs`

Representa uma execução de script.

Campos principais: `id`, `project_id`, `script`, `command`, `pid`, `pid_started_at`, `port`, `status`, `exit_code`, `error_code`, `error_message`, `started_at`, `ended_at`.

Regras:

- Um projeto só pode ter um run com `ended_at IS NULL`.
- `command` é auditoria do comando gerado internamente.
- `pid_started_at` evita matar PID reciclado.

## 10. Métricas de sucesso

- **Cobertura do inventário:** todos os projetos elegíveis das raízes aparecem após um scan.
- **Confiabilidade do start/stop:** zero processos órfãos após stop ou shutdown.
- **Segurança:** zero comandos arbitrários aceitos pela API.
- **Feedback:** status do card muda em até 2 s após start/stop.
- **Portas:** portas declaradas aparecem antes do start; portas descobertas aparecem após o boot.
- **Qualidade:** `lint`, `typecheck`, `test` e `build` verdes.
- **Documentação:** README, PRD e especificação técnica atualizados.

## 11. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Processo órfão após fechar o hub | Alto | Kill no shutdown, reconciliação no boot, índice de run ativo. |
| Matar PID errado | Crítico | Validar identidade do PID antes do `taskkill /T /F`. |
| Path traversal | Crítico | `realpath` + allowlist de raízes + rejeição de `..`. |
| Command injection | Crítico | Allowlist + regex + script existente + `shell: false`. |
| Porta ocupada | Médio | `409` informativo; nunca matar processo externo. |
| Monorepo mal detectado | Baixo | Expansão de workspace + `parent_id` + UI agrupada. |
| HMR do Next perder estado | Alto em dev | Singleton em `globalThis` + estado no SQLite. |
| `better-sqlite3` sem prebuild | Alto | Node LTS, Build Tools e fallback planejado para `node:sqlite`. |
| Scan lento | Médio | Skip list, profundidade limitada e timeout global. |

## 12. Roadmap

### F4 — Logs e streaming

- Ring buffer com limite e `seq`.
- Arquivo de log com cap de 5 MB.
- Sanitização de ANSI.
- `GET /api/runs/:runId` e `GET /api/runs/:runId/stream` (SSE).
- Viewer no detalhe com pausar, copiar, baixar e auto-scroll inteligente.
- Reconexão com `Last-Event-ID`.

### F5 — Hardening e entrega

- Testes de integração com banco temporário.
- E2E Playwright com fixture isolada.
- Limpeza de histórico na UI.
- Revisão de acessibilidade e responsividade.
- Security scan e revisão final.
- README e PRD mantidos junto do código.

### Futuro (não comprometido)

- Suporte a Linux/macOS.
- Autenticação opcional para uso em LAN.
- Métricas de CPU/RAM.
- Notificações de crash.
- Agendamento/restart automático.

## 13. Critérios de aceite do MVP

- [x] Inventário por scan, com projetos Node e não-Node.
- [x] Cadastro manual, edição, ocultação e remoção de registro.
- [x] Agrupamento de workspaces.
- [x] Cards com status, stack, branch, porta e última atividade.
- [x] Start/stop com allowlist e package manager.
- [x] Detecção de porta e tratamento de conflito.
- [x] Hub incluído no inventário e não iniciável.
- [x] Histórico dos últimos 10 runs.
- [x] Configurações somente leitura e health check.
- [x] Testes unitários verdes.
- [ ] Logs ao vivo e SSE.
- [ ] Limpeza de histórico.
- [ ] Suíte E2E.
- [ ] Validação final de shutdown com `Ctrl+C`.

## 14. Premissas e decisões

- O produto é local e single-user; autenticação não faz parte do MVP.
- O alvo é Windows; suporte cross-platform não está comprometido.
- O banco é SQLite embutido; não há serviço externo.
- Mutações usam Route Handlers, não Server Actions.
- O scan é sob demanda; não há watcher de filesystem.
- O hub não instala dependências nem roda build/test de outros projetos.
- O usuário pode editar porta e script padrão, mas não comandos livres.
- A especificação técnica detalhada fica em [`../dashboard-localhost.md`](../dashboard-localhost.md).

## 15. Glossário

| Termo | Definição |
|---|---|
| **Hub** | Esta aplicação, servida em `localhost:3100`. |
| **Projeto** | Pasta com `package.json` ou `.git` dentro de uma raiz monitorada. |
| **Workspace** | Projeto pai que agrupa pacotes via `pnpm-workspace.yaml` ou `workspaces`. |
| **Run** | Uma execução de script iniciada pelo hub. |
| **Allowlist** | Lista fechada de raízes ou scripts permitidos. |
| **Porta preferida** | Porta declarada no script ou editada pelo usuário. |
| **Reconciliação** | Processo de boot que adota runs vivas ou marca órfãs como `crashed`. |
