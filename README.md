# Hub Local

Hub local para inventariar, iniciar, parar e acompanhar projetos de desenvolvimento no Windows. A interface roda em `http://localhost:3100`, usa SQLite local e não depende de nuvem, Docker ou banco externo.

> **Status do projeto:** MVP em evolução. As fases F0–F3 estão implementadas; logs ao vivo/SSE (F4) e o pacote de hardening/E2E (F5) ainda estão pendentes. Veja o [PRD](docs/PRD.md) para o escopo e o estado de cada requisito.

## O que ele faz

- Escaneia raízes configuradas (padrão `C:\Projetos`) e monta um inventário de projetos Node e não-Node.
- Detecta monorepos/workspaces (`pnpm-workspace.yaml` e `workspaces` do `package.json`) e agrupa os pacotes sob o projeto pai.
- Exibe status, stack, branch, porta, uptime e última atividade de cada projeto.
- Inicia e para scripts permitidos (`dev`, `start`, `preview`) usando o package manager detectado.
- Detecta a porta do processo pelo log, pelo script ou pela árvore de PIDs.
- Impede start quando a porta já está ocupada, sem matar o processo dono.
- Permite buscar, filtrar, ocultar, editar, anotar e cadastrar projetos manualmente.
- Mostra os 10 runs mais recentes de cada projeto.
- Inclui o próprio hub no inventário, marcado como `hub` e sempre `rodando`.
- Expõe health check e configurações somente leitura em `/settings`.

### O que ainda não faz

- Não exibe logs ao vivo nem transmite SSE (F4). O buffer de log existe apenas em memória.
- Não grava arquivo de log por run; `HUB_LOG_MAX_BYTES` e `HUB_MAX_STREAMS` estão reservados para a F4.
- Não limpa histórico de runs pela interface.
- Não tem autenticação, multiusuário ou exposição em LAN.
- Não roda em Linux/macOS no estado atual: o controle de processos usa `cmd.exe`, `taskkill` e WMI do Windows.
- Não mede CPU/RAM nem mantém métricas históricas.
- A suíte E2E ainda não está configurada, apesar do script `test:e2e` existir no `package.json`.

## Requisitos

- Windows 10/11.
- Node.js **20.9 ou superior** (testado com Node 24.20.0).
- npm (testado com npm 11.19.0).
- PowerShell para os comandos de exemplo.

## Quick start

```powershell
git clone https://github.com/lsp3037/dashboard-localhost.git
cd dashboard-localhost
npm install
Copy-Item .env.example .env.local
npm run dev
```

Abra [http://localhost:3100](http://localhost:3100) e clique em **Escanear** para popular o inventário pela primeira vez. O banco é criado automaticamente em `.data/hub.db`.

O scan não roda automaticamente no boot: ele é disparado pelo botão **Escanear**, pelo CTA do estado vazio ou pela API.

### Trocar a porta

A porta efetiva é definida no `package.json`:

```json
"dev": "next dev -p 3100 --turbopack",
"start": "next start -p 3100"
```

Se mudar a porta, altere também `HUB_PORT` no `.env.local` para o mesmo valor. O hub escuta apenas em `localhost`.

## Configuração

Copie `.env.example` para `.env.local` e descomente o que precisar. Todas as variáveis têm default.

| Variável | Default | Descrição |
|---|---:|---|
| `HUB_PORT` | `3100` | Porta lógica do hub. Mantenha igual à porta usada pelo Next. |
| `HUB_PROJECTS_ROOTS` | `C:\Projetos` | Raízes monitoradas, separadas por `;`. |
| `HUB_SCAN_DEPTH` | `2` | Profundidade do scan (`1` ou `2`). Workspaces são expandidos além disso. |
| `HUB_BOOT_TIMEOUT_MS` | `90000` | Tempo máximo para o run sair de `starting` e ganhar porta. |
| `HUB_STOP_GRACE_MS` | `3000` | Reservado para o fluxo de parada. |
| `HUB_LOG_BUFFER_LINES` | `1000` | Linhas mantidas no ring buffer em memória por run. |
| `HUB_LOG_MAX_BYTES` | `5242880` | Reservado para a F4 (arquivo de log). |
| `HUB_MAX_RUNNING` | `4` | Runs simultâneos permitidos. |
| `HUB_MAX_STREAMS` | `20` | Reservado para a F4 (SSE). |
| `HUB_SCAN_TIMEOUT_MS` | `10000` | Timeout global do scan. |
| `HUB_ALLOWED_SCRIPTS` | `dev,start,preview` | Scripts que o hub pode executar. |
| `HUB_DATA_DIR` | `.data` | Diretório do SQLite e dados locais. |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o hub em `http://localhost:3100` com Turbopack. |
| `npm run build` | Gera o build de produção. |
| `npm run start` | Sobe o build de produção em `http://localhost:3100`. |
| `npm run lint` | Executa o ESLint. |
| `npm run typecheck` | Executa o TypeScript sem emitir arquivos. |
| `npm run test` | Executa os testes unitários com Vitest. |
| `npm run test:e2e` | Script reservado; a suíte Playwright ainda não foi configurada. |

Antes de abrir um PR, rode:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

## API

Todas as rotas usam JSON UTF-8, `runtime = 'nodejs'` e `dynamic = 'force-dynamic'`. Erros seguem o envelope:

```json
{
  "error": {
    "code": "PORT_IN_USE",
    "message": "Porta 3002 ocupada por node.exe (PID 4711).",
    "details": { "port": 3002, "pid": 4711, "owner": "external" }
  }
}
```

| Método | Rota | Função |
|---|---|---|
| `GET` | `/api/health` | Sanidade do banco e versão do hub. |
| `GET` | `/api/projects` | Lista projetos, run ativo e último run. |
| `POST` | `/api/projects` | Cadastra um projeto por caminho. |
| `POST` | `/api/projects/scan` | Escaneia as raízes permitidas. |
| `PATCH` | `/api/projects/:id` | Edita nome, notas, porta, script padrão ou visibilidade. |
| `DELETE` | `/api/projects/:id` | Oculta o projeto; `?hard=1` remove o registro. |
| `POST` | `/api/projects/:id/start` | Inicia um script permitido. |
| `POST` | `/api/projects/:id/stop` | Encerra a árvore de processos do run. |
| `GET` | `/api/projects/:id/status` | Estado do run e listeners da porta. |

Exemplo:

```powershell
curl.exe -s http://localhost:3100/api/health
curl.exe -s -X POST http://localhost:3100/api/projects/scan -H "Content-Type: application/json" -d "{}"
```

## Arquitetura

```text
Browser (localhost:3100)
  ├─ HTML/RSC ──────────────► Next.js App Router
  ├─ fetch JSON ────────────► Route Handlers (/api/*)
  └─ polling de status ─────► /api/projects/:id/status
                                   │
                                   ├─ SQLite (better-sqlite3, WAL) ─► .data/hub.db
                                   ├─ filesystem ────────────────────► raízes monitoradas
                                   └─ child_process ─────────────────► scripts dos projetos
```

- **Next.js 16 + React 19 + Tailwind CSS 4** para a interface.
- **SQLite + `better-sqlite3`** com SQL explícito e migrações por `PRAGMA user_version`.
- **Server Components** para leitura inicial; **Route Handlers** para mutações e status.
- **ProcessManager** singleton em `globalThis`, com lock por projeto e índice único de run ativo no banco.
- **Descoberta** tolerante a BOM/JSON inválido, com skip de `node_modules`, `.git`, builds e caches.
- **Segurança de execução**: allowlist de raízes e scripts, `spawn` com `shell: false`, kill apenas da árvore de PIDs do hub e validação de identidade do PID antes de matar.

### Estrutura

```text
src/
  app/                 páginas e route handlers
  components/          UI (cards, dialogs, filtros, status)
  lib/client/          fetch, toasts e polling no browser
  lib/server/          config, banco, scan, processos e repositórios
  lib/shared/          tipos, formatadores e view-models isomórficos
tests/unit/            testes Vitest
.data/                 SQLite e dados locais (gitignored)
```

## Segurança e limites

- O hub não tem autenticação. Ele foi feito para `localhost`; não exponha a porta 3100 na rede.
- O cliente nunca envia comando ou argumento: apenas o nome de um script da allowlist.
- O caminho do projeto precisa estar dentro de `HUB_PROJECTS_ROOTS`.
- O hub não mata processos que não iniciou. Porta ocupada gera `409 PORT_IN_USE` com PID/dono.
- O ambiente do processo filho remove variáveis internas do Next e não é exposto nos DTOs.
- Remover um projeto nunca apaga arquivos do disco; no máximo remove o registro do banco.

## Problemas comuns

**O botão Iniciar está desabilitado**
O projeto não tem `dev`, `start` ou `preview` no `package.json`, a pasta sumiu ou o próprio hub está selecionado.

**A porta aparece como `—`**
O script não declara `-p`/`--port` e o processo ainda não revelou a porta no log. Inicie o projeto ou edite a porta preferida no detalhe.

**Porta 3100 ocupada**
Encerre o processo que está usando a porta ou altere `dev`/`start` no `package.json` e `HUB_PORT` no `.env.local` juntos.

**`better-sqlite3` falhou no `npm install`**
Confirme se está usando uma versão LTS do Node com prebuild disponível. Se não houver prebuild, instale as Build Tools do Visual Studio e rode `npm rebuild better-sqlite3`.

**Nenhum projeto aparece**
Confirme `HUB_PROJECTS_ROOTS`, clique em **Escanear** e verifique se cada pasta tem `package.json` ou `.git`.

**`npm run test:e2e` falha**
A suíte Playwright ainda não foi implementada neste estágio. Use `npm run test` para os testes unitários.

## Documentação

- [PRD — requisitos, escopo e roadmap](docs/PRD.md)
- [Especificação técnica original](dashboard-localhost.md)
- [Exemplo de variáveis de ambiente](.env.example)

## Contribuição

- Crie uma branch por mudança.
- Mantenha o estilo de commits convencional já usado no repositório (`feat:`, `fix:`, `chore:`, `docs:`).
- Rode lint, typecheck, testes e build antes de enviar.
- Evite iniciar projetos reais em testes automatizados; prefira fixtures e diretórios temporários.

## Licença

Ainda não há licença definida neste repositório. O código é público, mas não há permissão explícita de reutilização até que uma licença seja adicionada.
