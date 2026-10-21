# dashboard-localhost — Hub de Projetos Local

| Campo | Valor |
|---|---|
| Tipo de projeto | **WEB** (full-stack Next.js, execução local) |
| Modo | Planejamento (Fase 1) — nenhum código de aplicação nesta etapa |
| Data | 20/10/2026 |
| Ambiente | Windows, PowerShell 5.1, Node v24.20.0, npm 11.19.0 |
| Raízes monitoradas | `C:\Projetos` (default) + raízes extras via `HUB_PROJECTS_ROOTS` (`;`-separado) |
| Profundidade do scan | `2` (pega monorepos como `prenatal-saas/apps/*`) |
| Porta do hub | `3100` (evita 3000 / 3002 / 5173 usadas pelos projetos) |
| Documento | `dashboard-localhost.md` (raiz do projeto) |

---

## 0. Decisões fechadas (baseline — não rediscutir)

| # | Decisão | Escolha | Motivo curto |
|---|---|---|---|
| D1 | Escopo do MVP | Inventário + controle de processos + logs | Usuário precisa operar, não só listar |
| D2 | Stack | Next.js App Router + SQLite + Tailwind CSS | SSR local, uma única stack, zero infra |
| D3 | Descoberta | Scan de `C:\Projetos` + cadastro manual | Cobre 7 irmãos com stacks variadas |
| D4 | Exposição | `localhost` apenas, sem autenticação | Máquina de dev, um usuário |
| D5 | Transporte de logs | SSE | Unidirecional, nativo, sem servidor custom |
| D6 | Driver do banco | `better-sqlite3` + SQL explícito | Síncrono, sem engine externo, sem codegen |
| D7 | Mutação | Route handlers (não server actions) | Contratos JSON testáveis, status HTTP corretos |
| D8 | Execução de scripts | Allowlist fixa `dev`, `start`, `preview` | Elimina execução de comando arbitrário |
| D9 | Gerência de processos | Singleton em `globalThis` + `taskkill /T /F` | Sobrevive ao HMR; único jeito confiável no Windows |
| D10 | Escopo do scan | **Profundidade 2** + múltiplas raízes (`HUB_PROJECTS_ROOTS`) | Aprovado pelo usuário: pega pacotes de monorepo (ex.: `prenatal-saas/apps/*`) e projetos fora de `C:\Projetos` |

### Estado real verificado da raiz

| Pasta | `package.json` | `.git` | Scripts relevantes | Situação no hub |
|---|---|---|---|---|
| `agentewhatsapp` | sim | não | `start`, `dev` | iniciável (sem branch) |
| `dashboard-localhost` | não (hoje) | não | — | **este hub** — excluir do scan |
| `Motor de Conteúdo do Instagram` | não | não | — | `non-node` (nome com espaço/acento) |
| `prenatal-saas` | sim | sim | sem `dev`/`start` | listado, **não iniciável** (monorepo pnpm) |
| `rea` | não | não | — | `non-node`, pasta vazia |
| `trustcare` | sim | sim | `dev` (`next dev`), `start` | iniciável |
| `trustcare-site` | sim | sim | `dev`, `start` | iniciável |
| `trustfrota` | sim | sim | `dev` (`next dev -p 3002`) | iniciável, porta fixa 3002 |

Consequência de projeto: 4 de 7 são iniciáveis. A UI precisa de um estado explícito **"sem script executável"** — não é erro, é dado.

Verificado também em 20/10/2026: os 5 projetos Node têm `node_modules` instalado (start não deve falhar por dependência faltando); `agentewhatsapp` não tem `.git` (branch = null); `prenatal-saas` é workspace pnpm com `apps/api`, `apps/web`, `packages/db`, `packages/ig-dpp` — os pacotes ficam a **3 níveis** de `C:\Projetos`, então só a expansão de workspace (§7.1, passo 3.1) os encontra.

---

## 1. Visão e escopo

### 1.1 Objetivo

Um hub local que responde três perguntas em uma tela: **o que eu tenho**, **o que está rodando**, **como subo/derrubo isso e vejo o log**.

### 1.2 Escopo do MVP

| # | Capacidade | Entrega | Critério de aceite |
|---|---|---|---|
| M1 | Inventário automático | Scan das raízes configuradas (default `C:\Projetos`), **profundidade 2**, grava/atualiza projetos | 7 pastas irmãs detectadas (5 `node`, 2 `non-node`), 4 iniciáveis, e pacotes aninhados de 1 nível (ex.: `prenatal-saas/apps/*`) quando existirem |
| M2 | Inventário manual | Adicionar por caminho, renomear, ocultar, anotar | Projeto manual sobrevive a re-scans; oculto some do grid |
| M3 | Controle de processo | Iniciar `dev`/`start`/`preview`, parar, ver PID/porta/uptime | `start` sobe o projeto; `stop` não deixa listener nem processo filho |
| M4 | Status em tempo real | Card reflete `parado / subindo / rodando / erro / porta ocupada` | Transição visível em ≤ 2 s sem refresh manual |
| M5 | Logs ao vivo | stdout+stderr no detalhe, com histórico da última execução | Linha do dev server aparece em ≤ 2 s |
| M6 | Detalhe do projeto | Caminho, stack, scripts, branch, porta, últimos runs | Abrir card mostra dados corretos do projeto |

### 1.3 Não-objetivos (ficam fora — não implementar)

- Autenticação, usuários, permissões, multiusuário.
- Exposição em rede/LAN, túnel, HTTPS, deploy.
- Git write ops (commit, pull, push, checkout) e edição de arquivos do projeto.
- Instalar dependências (`npm install`), rodar build, rodar testes de outros projetos.
- Terminal livre / shell interativo / comando customizado vindo da UI. **Nunca.**
- Docker, containers, PM2, WSL.
- Métricas de CPU/RAM por processo, gráficos históricos.
- Notificações desktop / e-mail.
- Mobile app / PWA offline.
- Edição de `package.json` dos projetos.

> Regra de ouro: se a feature exige executar algo que o usuário digitou, está fora do MVP.

---

## 2. Arquitetura

### 2.1 Topologia

```
Browser (localhost:3100)
   │  HTML/RSC          │ fetch JSON            │ EventSource (SSE)
   ▼                    ▼                       ▼
Next.js 16 (App Router, runtime nodejs, processo único)
   ├── Server Components  → leitura direta (db) 
   ├── Route Handlers     → mutações, status, stream
   ├── discovery/         → fs + package.json + git CLI
   ├── process/           → child_process (npm scripts) + taskkill
   ├── logs/              → ring buffer + arquivo
   └── db/                → better-sqlite3 (WAL)
        │
        ├── .data/hub.db        (SQLite)
        ├── .data/logs/*.log    (histórico)
        └── C:\Projetos\*\      (projetos gerenciados)
```

Um único processo Node. Não há worker, fila ou daemon separado no MVP: o `ProcessManager` vive no processo do Next. Isso simplifica start/stop e stream, ao custo de exigir reconciliação no boot (seção 6.8).

### 2.2 Fronteiras de runtime

| Camada | Onde | Regra |
|---|---|---|
| Leitura de página | `app/**/page.tsx` (Server Component) | Pode importar `db`; nunca `child_process` direto |
| Mutações | `app/api/**/route.ts` | `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, validação Zod |
| Interação | `components/**` (client) | Só `fetch` para `/api/*` e `EventSource` |
| Lógica de sistema | `lib/server/**` | `import 'server-only'`; nunca importado por client component |

`better-sqlite3` e `child_process` exigem Node runtime: **nada de edge runtime** neste projeto. Em `next.config.ts`, `serverExternalPackages: ['better-sqlite3']`.

### 2.3 Route handlers vs Server Actions

| Critério | Server Actions | Route Handlers (escolhido) |
|---|---|---|
| Streaming contínuo | Não suporta | Sim (SSE) |
| Status HTTP / códigos de erro | Opaco (redirect/erro genérico) | Explícito (409, 422) |
| Testável via `curl` / Vitest | Difícil | Direto (Request → Response) |
| Contrato para UI client | Acoplado ao React | JSON estável |
| Cache | Semântica implícita | `no-store` explícito |

Decisão: **100% route handlers** para mutação/status/stream; Server Components só para render inicial.

### 2.4 ProcessManager singleton

```ts
// src/lib/server/process/manager.ts
export type RunStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed' | 'failed';

export interface RunState {
  runId: string; projectId: string; script: string;
  pid: number | null; pidStartedAt: string | null;
  port: number | null; status: RunStatus;
  startedAt: string; exitCode: number | null;
  errorCode?: string;
}

export interface ProcessManager {
  start(projectId: string, script?: string): Promise<RunState>;
  stop(projectId: string): Promise<RunState>;
  get(projectId: string): RunState | null;
  subscribe(runId: string, fn: (e: LogEvent) => void): () => void;
  tail(runId: string, limit?: number): LogEvent[];
  shutdown(): Promise<void>;
}
```

Instância guardada em `globalThis.__hubProcessManager` (não em variável de módulo): o Next recarrega módulos em dev e zeraria o `Map` de processos vivos, deixando órfãos sem referência. O estado durável continua no SQLite (`process_runs`). Para uso diário, preferir `npm run build && npm start` (sem HMR): elimina recarregamentos com runs ativas.

### 2.5 SSE, não WebSocket

| Requisito | SSE | WebSocket |
|---|---|---|
| Direção | server → client (é o caso: logs) | bidirecional (desnecessário) |
| Reconnect | nativo no `EventSource`, com `Last-Event-ID` | manual |
| Infra no Next | route handler comum | precisa upgrade/servidor custom ou lib |
| Dependências | 0 | `ws` + handling |
| Proxy/buffering | ok com `no-transform` | ok |

Comandos (start/stop) são POSTs curtos. Logo: **SSE**. Um `EventSource` por run aberto (no detalhe), máximo 20 assinantes por run.
### 2.6 Fluxo de start

```
UI POST /api/projects/:id/start
  → valida id, resolve projeto (db)
  → porta ocupada? → 409 PORT_IN_USE (informa pid/dono, não mata)
  → script ∈ allowlist E ∈ package.json.scripts? senão 422 SCRIPT_NOT_ALLOWED
  → cria run (status=starting) + spawn (cwd=project.path, cmd.exe /d /s /c npm run <script>)
  → 202 { run }
  → assíncrono: lê stdout/stderr, parseia porta, atualiza run → running
  → SSE emite status/port/log
```

### 2.7 Fluxo de log

```
child.stdout/stderr (readline por linha)
  → sanitiza ANSI, timestamps, seq++
  → ring buffer (1000 linhas / 256 KB) + append em .data/logs/<runId>.log
  → broadcast para subscribers SSE
  → exit → status final, flush, evento `end`
```

### 2.8 Modelo de concorrência

- Chamadas `better-sqlite3` são síncronas: aceitáveis (sub-ms) para queries pontuais, mas **nunca** dentro de loops de scan grandes. Scan usa `fs.promises` e só toca o banco em transação única no final.
- Sem `await` entre "checar se já roda" e "criar run": lock por `projectId` (`Map<string, Promise>`) + índice único parcial no banco.
- Máximo de **4 runs simultâneos** (config `HUB_MAX_RUNNING`), porque 8 Next devs derrubam a máquina.
- Escrita no log em arquivo via stream com `flags: 'a'`; nunca `appendFile` por linha.

---

## 3. Modelo de dados

### 3.1 Decisão de ORM

**Escolhido: `better-sqlite3` + SQL explícito + migrações por `PRAGMA user_version`.**

| Opção | Prós | Contras | Veredito |
|---|---|---|---|
| `better-sqlite3` + SQL | síncrono, prebuild para Node 24, zero codegen, controle total de índices/WAL | tipos escritos à mão | **adotado** |
| Prisma | schema declarativo, tipos gerados | engine binário, `prisma generate` no build, locks de arquivo no Windows, overkill para 2 tabelas | rejeitado |
| Drizzle | tipos bons, SQL-first | camada extra + `drizzle-kit` para 2 tabelas | rejeitado no MVP (fallback se doer) |
| `node:sqlite` | nativo, zero deps | API ainda em evolução no Node 24 | fallback escondido atrás de `db/driver.ts` |

Contingência: se o prebuild de `better-sqlite3` falhar (Node 24 + Windows sem toolchain), trocar o driver para `node:sqlite` (`DatabaseSync`) mantendo a mesma interface de repositório — por isso `db/driver.ts` é isolado.

### 3.2 PRAGMAs de conexão

```sql
PRAGMA journal_mode = WAL;      -- leitura durante escrita
PRAGMA busy_timeout = 5000;     -- evita SQLITE_BUSY
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;    -- WAL + dev local
```

Conexão única em `globalThis.__hubDb` (mesmo motivo do manager). Arquivo: `.data/hub.db`.

### 3.3 Schema (v1)

```sql
CREATE TABLE projects (
  id               TEXT PRIMARY KEY,                    -- crypto.randomUUID()
  name             TEXT NOT NULL,
  path             TEXT NOT NULL,                       -- absoluto, normalizado (realpath)
  parent_id        TEXT REFERENCES projects(id) ON DELETE SET NULL, -- projeto pai (workspace/monorepo)
  source           TEXT NOT NULL DEFAULT 'scan'         -- 'scan' | 'manual'
                     CHECK (source IN ('scan','manual')),
  kind             TEXT NOT NULL DEFAULT 'node'         -- 'node' | 'non-node'
                     CHECK (kind IN ('node','non-node')),
  hidden           INTEGER NOT NULL DEFAULT 0,
  missing          INTEGER NOT NULL DEFAULT 0,          -- pasta sumiu do disco
  stack            TEXT NOT NULL DEFAULT '[]',          -- JSON: ["next","react","tailwind"]
  package_manager  TEXT                                -- 'npm'|'pnpm'|'yarn'|'bun'|null
                     CHECK (package_manager IN ('npm','pnpm','yarn','bun') OR package_manager IS NULL),
  scripts          TEXT NOT NULL DEFAULT '[]',          -- JSON: nomes de scripts do package.json
  default_script   TEXT,                                -- 'dev' preferencial
  preferred_port   INTEGER,
  git_branch       TEXT,                                -- cache do scan (não tempo real)
  git_head_at      TEXT,                                -- data do último commit
  notes            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_scanned_at  TEXT
);
CREATE UNIQUE INDEX idx_projects_path ON projects(path);

CREATE TABLE process_runs (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  script           TEXT NOT NULL,
  command          TEXT NOT NULL,                       -- auditoria: comando gerado internamente
  pid              INTEGER,
  pid_started_at   TEXT,                                -- CreationDate do PID (anti-PID-reuse)
  port             INTEGER,
  status           TEXT NOT NULL
                     CHECK (status IN ('starting','running','stopping','stopped','crashed','failed')),
  exit_code        INTEGER,
  error_code       TEXT,
  error_message    TEXT,
  log_path         TEXT,
  started_at       TEXT NOT NULL,
  ended_at         TEXT
);
CREATE INDEX idx_runs_project ON process_runs(project_id, started_at DESC);
CREATE UNIQUE INDEX idx_runs_one_active
  ON process_runs(project_id) WHERE ended_at IS NULL;
```

Notas de modelagem:

- **Sem tabela `project_settings`**: todas as configurações são 1:1 com projeto (porta, script, oculto, notas). Uma tabela a mais só criaria join. Se surgirem configurações globais, usar `app_settings(key TEXT PRIMARY KEY, value TEXT)`.
- **Sem tabela `notes`**: uma coluna `notes TEXT` resolve; histórico de notas não é requisito.
- `path` único normalizado é a chave natural do scan (upsert por `path`).
- `hidden` é soft delete; `DELETE ?hard=1` remove a linha (e nunca toca nos arquivos).
- `missing` separa "pasta removida" de "oculto pelo usuário".
- JSON em `stack`/`scripts` porque são listas de exibição, não filtros SQL no MVP.

### 3.4 Migração e repositórios

```ts
// src/lib/server/db/index.ts
export function getDb(): Database;
export function migrate(db: Database): void; // lê user_version, aplica 1..N em transação

// src/lib/server/repos/projects.ts
export function upsertScannedProject(input: ScannedProject): 'added' | 'updated' | 'unchanged';
export function listProjects(opts: { includeHidden?: boolean }): ProjectRow[];
export function getProject(id: string): ProjectRow | null;
export function updateProject(id: string, patch: ProjectPatch): ProjectRow;
export function markMissing(paths: string[]): number;

// src/lib/server/repos/runs.ts
export function createRun(input: NewRun): RunRow;           // falha se já houver ativo
export function finishRun(id: string, result: RunResult): void;
export function getActiveRuns(): RunRow[];
export function listRuns(projectId: string, limit?: number): RunRow[];
```

---

## 4. Contratos de API

### 4.1 Convenções

- Base: `http://localhost:3100/api`.
- JSON UTF-8; `Content-Type: application/json`.
- Toda rota: `export const runtime = 'nodejs'` e `export const dynamic = 'force-dynamic'`.
- Erros sempre no envelope:

```json
{ "error": { "code": "PORT_IN_USE", "message": "Porta 3000 ocupada por node.exe (PID 4711)", "details": { "port": 3000, "pid": 4711, "owner": "external" } } }
```

- Validação de body com Zod; erro → `400 INVALID_BODY` com `details.issues`.
- Next 16: `params` é `Promise` → `{ params }: { params: Promise<{ id: string }> }`.
- Nenhuma rota aceita caminho arbitrário de execução ou nome de comando.

### 4.2 Tabela de endpoints

| Método | Rota | Função | Sucesso | Erros principais |
|---|---|---|---|---|
| GET | `/api/projects` | lista projetos + run ativo | 200 `{ projects: ProjectDTO[] }` | 500 |
| POST | `/api/projects/scan` | re-scan da raiz | 200 `{ added, updated, unchanged, missing, skipped, durationMs }` | 403 PATH_NOT_ALLOWED, 500 SCAN_FAILED |
| POST | `/api/projects` | cadastro manual | 201 `{ project }` | 400, 403, 404 NOT_FOUND, 409 ALREADY_EXISTS |
| PATCH | `/api/projects/:id` | editar nome/notas/porta/script/ocultar | 200 `{ project }` | 400, 404, 422 SCRIPT_NOT_ALLOWED |
| DELETE | `/api/projects/:id` | ocultar (default) ou remover | 200 `{ project }` / 204 | 404, 409 RUNNING |
| POST | `/api/projects/:id/start` | inicia dev server | 202 `{ run }` | 403 PATH_NOT_ALLOWED, 404, 409 ALREADY_RUNNING / PORT_IN_USE, 422 SCRIPT_NOT_ALLOWED / NO_SCRIPT, 500 SPAWN_FAILED |
| POST | `/api/projects/:id/stop` | encerra árvore | 200 `{ run }` | 404, 409 NOT_RUNNING, 500 KILL_FAILED |
| GET | `/api/projects/:id/status` | polling de fallback | 200 `{ projectId, run: RunState \| null, port, listeners }` | 404 PROJECT_NOT_FOUND |
| GET | `/api/runs/:runId` | metadata + últimas N linhas | 200 `{ run, lines }` | 404 RUN_NOT_FOUND |
| GET | `/api/runs/:runId/stream` | SSE de logs/status | 200 `text/event-stream` | 404 RUN_NOT_FOUND, 429 TOO_MANY_STREAMS |
| GET | `/api/health` | sanidade | 200 `{ ok, db, version, roots }` | 500 |

### 4.3 Payloads

**GET /api/projects**

```json
{
  "projects": [{
    "id": "9f1c...", "name": "trustfrota", "path": "C:\\Projetos\\trustfrota",
    "kind": "node", "hidden": false, "missing": false,
    "stack": ["next", "react", "tailwind"], "packageManager": "npm",
    "scripts": ["dev", "build", "start"],
    "runnableScripts": ["dev", "start"],
    "defaultScript": "dev", "preferredPort": 3002, "notes": null,
    "gitBranch": "main", "gitHeadAt": "2026-10-18T14:02:11.000Z",
    "run": { "id": "r_01", "status": "running", "port": 3002, "pid": 8123, "startedAt": "2026-10-20T09:12:00.000Z" },
    "lastRun": { "id": "r_00", "status": "stopped", "endedAt": "2026-10-19T22:40:00.000Z" }
  }]
}
```

**POST /api/projects/scan** — body opcional `{ "roots": ["C:\\Projetos"], "depth": 2 }` (cada raiz e `depth` ≤ 2 precisam estar na allowlist/config).

```json
{ "added": 2, "updated": 1, "unchanged": 4, "missing": 0, "skipped": 1, "durationMs": 412 }
```

**POST /api/projects** — `{ "path": "C:\\Projetos\\novo-app", "name": "Novo App" }` → 201. `path` deve existir, estar sob raiz permitida, conter `package.json` ou `.git`.

**PATCH /api/projects/:id** — qualquer subconjunto: `{ name?, notes?, preferredPort?, defaultScript?, hidden? }`.

**POST /api/projects/:id/start** — `{ "script": "dev" }` opcional.

```json
{ "run": { "id": "r_01", "projectId": "9f1c...", "script": "dev", "status": "starting", "pid": 8123, "port": null, "startedAt": "2026-10-20T09:12:00.000Z" } }
```

**POST /api/projects/:id/stop** → 200 `{ "run": { "status": "stopped", "exitCode": 1, "endedAt": "..." } }`.

**GET /api/projects/:id/status**

```json
{ "projectId": "9f1c...", "run": null, "port": null, "listeners": [{ "port": 3000, "pid": 4711, "external": true }] }
```

### 4.4 SSE — `GET /api/runs/:runId/stream`

Headers de resposta: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

```text
retry: 1000

id: 1
event: status
data: {"status":"starting","port":null}

id: 2
event: log
data: {"seq":2,"ts":"2026-10-20T09:12:01.120Z","stream":"stdout","line":"▲ Next.js 16.4.2"}

id: 3
event: log
data: {"seq":3,"ts":"2026-10-20T09:12:01.480Z","stream":"stdout","line":"- Local: http://localhost:3002"}

event: status
data: {"status":"running","port":3002,"pid":8123}

event: ping
data: {}

event: end
data: {"status":"stopped","exitCode":0}
```

Regras:

- `id` = `seq` monotônico por run; reconexão envia `Last-Event-ID` e o servidor reenvia do buffer a partir de `seq > lastEventId` (`?since=` como alternativa).
- `ping` a cada 15 s (evita timeout de conexão).
- Servidor encerra o stream no exit do processo; UI faz fallback para `GET /status`.
- Stream de run já encerrado: reenvia as últimas 100 linhas e fecha — permite abrir histórico.
- `details` nunca inclui env do processo (pode conter segredos).
---

## 5. UI

### 5.1 Telas

| Rota | Tela | Conteúdo |
|---|---|---|
| `/` | Dashboard | Header com contadores (rodando/parados/erro), botão **Escanear**, grid de cards, filtro (todos / rodando / ocultos) |
| `/projects/[id]` | Detalhe | Cabeçalho (nome, path copiável, stack, branch, botões Iniciar/Parar), painel de status (PID, porta, uptime, script), log viewer, últimos 10 runs |
| `/settings` | Configurações | Raiz monitorada (read-only), allowlist de scripts, limites (timeout, buffer, max runs), ações: re-scan, limpar histórico de runs |
| modal | Adicionar projeto | Input de caminho + nome opcional + validação inline |

### 5.2 Layout do card

```
┌──────────────────────────────────────────────┐
│ ● trustfrota                      [Iniciar] │   ● status dot (verde/amarelo/vermelho/cinza)
│ Next · React · Tailwind                      │   badges de stack (máx. 3 + "+n")
│ main · porta 3002 · ↑ 12 min                 │   branch · porta · uptime
│ C:\Projetos\trustfrota                       │   path truncado (middle-ellipsis)
└──────────────────────────────────────────────┘
```

- **Stack**: badges derivadas de `stack`; `non-node` → badge "sem app".
- **Porta**: chip clicável `localhost:3002` (abre nova aba); `—` se desconhecida.
- **Branch**: de `git_branch` (cache do scan); `sem git` se null.
- **Última atividade**: `max(run.startedAt, gitHeadAt, project.updatedAt)` formatado relativo ("há 12 min"). Se > 30 dias → "há 2 meses".
- **Ações no card**: Iniciar/Parar + menu (`⋯`) com Detalhe, Editar, Ocultar. Nunca ação destrutiva sem confirmação.
- Estado "sem script executável" (ex.: `prenatal-saas`): botão desabilitado com tooltip "Nenhum script dev/start/preview no package.json".

### 5.3 Matriz de estados

| Estado | Origem | Card | Ação disponível |
|---|---|---|---|
| `empty` | 0 projetos no banco | Empty state com CTA "Escanear C:\Projetos" | Escanear / adicionar manual |
| `scanning` | scan em andamento | Skeleton nos cards + progress no header | — |
| `stopped` | sem run ativo | Dot cinza, botão Iniciar | Iniciar |
| `starting` | run.status=starting | Dot amarelo pulsando, "subindo…", spinner no botão | Parar |
| `running` | run.status=running | Dot verde, porta + uptime ao vivo | Parar, abrir |
| `stopping` | run.status=stopping | Dot amarelo, "encerrando…" | — |
| `crashed` | exit ≠ 0 inesperado | Dot vermelho, "caiu (código 1)" + link "ver log" | Iniciar novamente |
| `failed` | spawn/allowlist/timeout | Dot vermelho, mensagem curta (error_code) | Ver detalhe |
| `port-in-use` | 409 PORT_IN_USE | Dot laranja, "porta 3000 ocupada por node.exe" | Alterar porta / ver detalhe |
| `missing` | pasta sumiu | Card esmaecido, badge "pasta não encontrada" | Remover cadastro |
| `hidden` | hidden=1 | Fora do grid por padrão | Mostrar ocultos |

### 5.4 Log viewer

- `<pre>` monoespaçado com linhas numeradas por `seq`, cores por stream (`stderr` âmbar, `system` cinza).
- Auto-scroll **apenas** se o usuário estiver no fim; scroll manual pausa o auto-scroll e mostra botão "ir para o fim".
- Toolbar: pausar/retomar (bufferiza no client), copiar, baixar `.log`, limpar visual, toggle "seguir".
- Limite de render: últimas 1000 linhas (o buffer do servidor já limita); sem virtualização no MVP.
- Reconexão: `EventSource` com `Last-Event-ID`; após 3 falhas, cai para polling de `/status` a cada 3 s e mostra banner "reconectando".

### 5.5 Direção visual (anti-template)

- Tema escuro neutro (slate/zinc 950) + acento **ciano/teal**; **proibido roxo/violeta**.
- Tipografia: `Inter` (UI) + `JetBrains Mono` (path, porta, log).
- Densidade alta, bordas 1px, sem gradientes decorativos, sem hero de marketing.
- Grid responsivo: 1 col < 640px, 2 col < 1280px, 3 col ≥ 1280px; sidebar fixa só em desktop.
- Acessibilidade: status nunca só por cor (dot + texto), foco visível, `aria-live="polite"` no status do card, contraste AA.

---

## 6. Controle de processos no Windows (seção crítica)

### 6.1 Modelo de ameaça

A UI comanda execução de código. Cenários de abuso/erro:

1. Caminho manipulado (`..\..\Windows\System32`) → executar fora da raiz.
2. Nome de script manipulado (`dev && format c:`) → injeção de shell.
3. Matar processo errado por PID reciclado ou árvore errada.
4. Deixar dev server órfão após fechar o hub.
5. Matar processo externo que já ocupava a porta.
6. Vazar segredos do `.env` do projeto nos logs/UI.

### 6.2 Controles obrigatórios

| # | Controle | Implementação |
|---|---|---|
| C1 | Allowlist de raízes | `HUB_PROJECTS_ROOTS` (`;`-separado, default `C:\Projetos`); normalizar cada raiz com `fs.realpathSync.native` + `path.resolve`; aceitar apenas se `path.relative(root, target)` não começa com `..` e não é absoluto para **alguma** raiz; comparação case-insensitive |
| C2 | Allowlist de scripts | `dev`, `start`, `preview` (env `HUB_ALLOWED_SCRIPTS`); precisa existir em `package.json.scripts`; regex `^[a-z0-9:_-]{1,32}$` |
| C3 | Sem comando livre | API nunca aceita comando/args; comando é montado de template fixo |
| C4 | Sem shell com input | `spawn`/`execFile` com array de args; caminho só via `cwd`, jamais concatenado na string |
| C5 | Um run por projeto | lock em memória + índice único parcial |
| C6 | Kill restrito à árvore | PID raiz gravado + `taskkill /T`, com validação de `CreationDate` antes |
| C7 | Porta ocupada ≠ matar | pré-checagem; se o listener não é da árvore do run, apenas reportar 409 |
| C8 | Limpeza no shutdown | `SIGINT`/`SIGTERM`/`exit` → kill síncrono das runs ativas; reconciliação no boot |
| C9 | Sem vazamento de env | logs não imprimem `process.env`; DTO não expõe env; não logar body de request |

### 6.3 Construção do comando

```ts
const RUNNERS = {
  npm:  (s: string) => ['cmd.exe', ['/d', '/s', '/c', `npm run ${s}`]],
  pnpm: (s: string) => ['cmd.exe', ['/d', '/s', '/c', `pnpm run ${s}`]],
  yarn: (s: string) => ['cmd.exe', ['/d', '/s', '/c', `yarn ${s}`]],
  bun:  (s: string) => ['cmd.exe', ['/d', '/s', '/c', `bun run ${s}`]],
} as const;
```

- No Windows, `npm` é `npm.cmd`: `spawn('npm', ..., { shell: false })` falha com `EINVAL`. Por isso `cmd.exe` como executável e `shell: false`.
- `script` já passou por C2 (allowlist + existência). Nenhum outro texto entra na string.
- Opções do spawn:

```ts
spawn(exe, args, {
  cwd: project.path,            // resolve espaços/acentos sem quoting manual
  shell: false,
  windowsHide: true,
  detached: false,
  env: buildChildEnv(project),  // ver 6.4
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

### 6.4 Ambiente do filho

- Copiar `process.env`, mas remover o `PORT` herdado do hub, `NODE_OPTIONS`, `NEXT_RUNTIME`, `__NEXT_PRIVATE_*`.
- Definir `BROWSER=none`, `NO_COLOR=1`, `FORCE_COLOR=0`, `NEXT_TELEMETRY_DISABLED=1`, `HUB_RUN_ID`.
- `PORT` só é injetado quando o projeto é Next **e** o script não contém `-p/--port` **e** há `preferred_port`. Vite ignora `PORT` (usa `--port`), então para Vite apenas se informa a porta desejada na UI — sem forçar.
- Nunca usar `env: { ...process.env, ...projectEnv }` com valores vindos do banco (não há campo para isso no MVP).

### 6.5 Detecção de porta

Ordem de tentativas:

1. **Parse do stdout/stderr** (mais confiável):
   - Next: `Local:\s+http?://localhost:(\d+)`, `- Local:`, `started server on .*:(\d+)`.
   - Vite: `Local:\s+http://localhost:(\d+)`.
   - Genérico: `https?://(?:localhost|127\.0\.0\.1):(\d+)`, `listening on .*:(\d+)`, `port\s*[:=]\s*(\d+)` (aceitar só 1024–65535).
2. **Script declarado**: regex `(?:-p|--port)[ =](\d{2,5})` no valor do script (ex.: `trustfrota` → 3002).
3. **Porta do processo**: `findPortForPidTree(pid)` — enumera descendentes por `Win32_Process.ParentProcessId` (recursivo, máx. 8 níveis) e cruza com listeners de `Get-NetTCPConnection`/`netstat -ano -p TCP | findstr LISTENING`.
4. **Fallback**: `null` → UI mostra "porta desconhecida" e permite preencher `preferred_port`.

Cache: a porta é gravada no run (`process_runs.port`) e atualizada só se mudar. Parser puro e testável:

```ts
export function parsePortFromLine(line: string): number | null;
export function parseScriptPort(scriptCommand: string): number | null;
export function listListeners(): Promise<Map<number, number>>; // porta -> pid
export async function findPortForPidTree(rootPid: number): Promise<number | null>;
```

### 6.6 Kill: protocolo

```ts
async function killTree(pid: number, expectedStartedAt: string): Promise<void> {
  // 1. validar identidade do PID
  //    Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" → CreationDate
  //    |CreationDate - expectedStartedAt| > 2s  → abortar (PID reciclado)
  // 2. taskkill /PID <pid> /T /F   (execFile, sem shell)
  // 3. aguardar evento 'exit' até 5s; senão tentar Stop-Process -Id <pid> -Force
  // 4. verificar listeners: porta do run sem listener da árvore → ok
}
```

Regras:

- `taskkill /T` é obrigatório: `cmd.exe` → `node` → `next-server`; matar só o pai deixa o dev server vivo.
- **Nunca** `taskkill /IM node.exe` nem `Stop-Process -Name node`.
- Se o PID raiz já morreu, **não** tentar matar descendentes com PIDs capturados depois: marcar `crashed` e listar listeners da porta como externos.
- `taskkill` retorna 128 quando o processo já não existe → tratar como sucesso idempotente.
- `CreationDate` vem em horário local do WMI: converter para UTC antes de comparar com `pid_started_at` (ISO UTC).
- Após kill, fechar streams de log e gravar `ended_at`, `exit_code`, `status`.

### 6.7 Porta ocupada por processo externo

Pré-checagem antes do spawn:

```ts
const listeners = await listListeners();
if (listeners.has(targetPort)) {
  const pid = listeners.get(targetPort)!;
  const ownedByHub = manager.ownsPid(pid);
  if (ownedByHub) throw new AppError('ALREADY_RUNNING', ..., 409);
  throw new AppError('PORT_IN_USE', `Porta ${targetPort} ocupada por ${name} (PID ${pid})`, 409,
    { port: targetPort, pid, owner: 'external', processName: name });
}
```

A UI apenas informa e sugere: alterar `preferred_port` ou parar o processo manualmente. **O hub nunca mata processo que não iniciou.**

### 6.8 Limites e ciclo de vida

| Limite | Default | Config |
|---|---|---|
| Timeout de boot (até status `running`) | 90 s | `HUB_BOOT_TIMEOUT_MS` |
| Timeout de stop (grace antes de `/F`) | 3 s | `HUB_STOP_GRACE_MS` |
| Buffer de log em memória | 1000 linhas / 256 KB por run | `HUB_LOG_BUFFER_LINES` |
| Arquivo de log | 5 MB, truncado ao abrir (append + cap) | `HUB_LOG_MAX_BYTES` |
| Runs simultâneos | 4 | `HUB_MAX_RUNNING` |
| Assinantes SSE por run | 20 | `HUB_MAX_STREAMS` |
| Timeout de scan | 10 s total, 1,5 s por diretório | `HUB_SCAN_TIMEOUT_MS` |

Ciclo de vida:

- **Boot**: abrir DB, migrar, reconciliar runs `ended_at IS NULL`:
  - PID vivo **e** `CreationDate` compatível → adotar como `running` (recuperação);
  - caso contrário → `status='crashed'`, `error_code='ORPHAN_RECONCILED'`, `ended_at=now`.
  - Nunca matar no boot; apenas reconciliar.
- **Shutdown**: `SIGINT`/`SIGTERM` → para todas as runs com `execFileSync('taskkill', ['/PID', pid, '/T', '/F'])` (síncrono, porque `exit` não espera promises) → fechar DB.
- **Crash do hub**: runs ficam órfãs; a reconciliação as marca como `crashed` e a UI mostra o listener externo na porta, com instrução de kill manual.
- **Timeout de boot**: não matar automaticamente (cold start de Next pode passar de 90 s); marcar `running` com `port=null` e `warning='BOOT_TIMEOUT'`; usuário decide parar.

### 6.9 Mapa de erros → UI

| `error_code` | HTTP | Mensagem | Ação na UI |
|---|---|---|---|
| `PATH_NOT_ALLOWED` | 403 | Caminho fora da raiz permitida | Corrigir caminho |
| `SCRIPT_NOT_ALLOWED` | 422 | Script não permitido para este projeto | Escolher da lista |
| `NO_SCRIPT` | 422 | Nenhum script executável | Desabilitar start |
| `ALREADY_RUNNING` | 409 | Projeto já está rodando | Mostrar "Parar" |
| `NOT_RUNNING` | 409 | Nenhum processo ativo | Atualizar card |
| `PORT_IN_USE` | 409 | Porta ocupada por processo externo | Sugerir outra porta |
| `SPAWN_FAILED` | 500 | Falha ao iniciar processo | Ver detalhe/log |
| `KILL_FAILED` | 500 | Não foi possível encerrar | Instrução manual |
| `PROJECT_MISSING` | 409 | Pasta não encontrada | Remover cadastro |

---

## 7. Descoberta automática

### 7.1 Algoritmo

```ts
export interface ScanOptions {
  roots: string[];        // allowlist aplicada em CADA raiz
  maxDepth?: number;      // default 2
  concurrency?: number;
}
export interface ScanResult { added: number; updated: number; unchanged: number; missing: number; skipped: number; durationMs: number; }
export function scanProjects(opts: ScanOptions): Promise<ScanResult>;
```

Passos:

1. Resolver cada raiz via allowlist; raiz inválida é ignorada com `skipped++` (todas inválidas → 403).
2. `readdir(root, { withFileTypes: true })` para cada raiz.
3. Para cada entrada, em BFS até `maxDepth=2`:
   - ignorar arquivos; ignorar dotdirs (`.git`, `.agents`, `.next`, `.opencode`, `.data`);
   - ignorar nomes em `SKIP_DIRS = [node_modules, .next, dist, build, out, coverage, .turbo, .cache, venv, .venv, target]`;
   - ignorar symlinks/junctions (`isSymbolicLink()`), evitando ciclos;
   - se `realpath(path) === realpath(process.cwd())` → marcar como `isHub` e pular (o próprio hub não se gerencia);
   - candidato se existe `package.json` **ou** `.git`; senão `kind='non-node'` (listado como pasta, não iniciável);
   - **descer 1 nível em diretórios candidatos também** (pega workspaces `apps/*`, `packages/*`); o filho herda `parentId` para a UI agrupar; máximo absoluto `maxDepth=2`.
3.1. **Expansão de workspace (obrigatória)**: se o diretório tem `pnpm-workspace.yaml`, `pnpm-workspace.yml` ou `package.json.workspaces`/`packages`, ler os globs (`apps/*`, `packages/*`) e tratar cada diretório que casa como candidato, com `parent_id` = id do workspace root. Esses filhos contam como profundidade 1 *relativa ao workspace*, não ao root — é isso que pega `prenatal-saas/apps/web` (que está a 3 níveis de `C:\Projetos`). Globs fora da raiz permitida são ignorados; `node_modules`/`.next` nunca casam.
4. Ler `package.json` com tolerância: `readFile` como buffer → remover BOM (`EF BB BF`) → `JSON.parse`; falha → `kind='non-node'`, `notes` intocada, `package_manager=null`.
5. Ler lockfiles para package manager: `pnpm-lock.yaml` → pnpm; `yarn.lock` → yarn; `bun.lockb`/`bun.lock` → bun; `package-lock.json` → npm; default npm.
6. `git rev-parse --abbrev-ref HEAD` via `execFile('git', ['-C', path, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeout: 2000 })`; e `git log -1 --format=%cI` para `git_head_at`. Ausência de `.git` → null, sem erro.
7. Detectar stack (7.2).
8. Upsert em transação única por `path` (inclui `parent_id` quando o pai também é projeto):
   - novo → `source='scan'`;
   - existente de scan → atualiza metadados, **nunca** sobrescreve `hidden`, `notes`, `preferred_port` (preferências do usuário);
   - existente manual → atualiza apenas dados técnicos, mantém `source='manual'`;
   - `missing=1` para paths de scan que sumiram e não estavam `missing`.
9. Retornar contadores.

Concorrência: `p-limit` caseiro (8) para `stat`/`readFile`; git roda em pool de 2 (processos externos são caros). Scan é idempotente e pode rodar em paralelo com leitura (WAL).

### 7.2 Detecção de stack

| Sinal | Tag | Observação |
|---|---|---|
| dep `next` | `next` | + `react` |
| dep `vite` | `vite` | + `react` se houver |
| dep `react` / `react-dom` | `react` | |
| dep `vue` / `nuxt` | `vue` / `nuxt` | |
| dep `svelte` / `@sveltejs/kit` | `svelte` | |
| dep `react-native` / `expo` | `react-native` / `expo` | |
| dep `express` / `fastify` / `hono` | `express` etc. | |
| dep `tailwindcss` + `@tailwindcss/postcss` | `tailwind` | |
| dep `typescript` ou `tsconfig.json` | `typescript` | |
| dep `vitest` / `jest` / `@playwright/test` | `test` | não exibido por padrão |
| arquivos `next.config.*`, `vite.config.*`, `astro.config.*` | tag correspondente | fallback quando deps não bastam |
| sem `package.json` | `non-node` | não iniciável |

Nome exibido: `package.json.name` se existir e não for genérico; senão nome da pasta (preserva acentos/espaços, ex.: `Motor de Conteúdo do Instagram`).

`runnableScripts` = interseção entre `Object.keys(package.json.scripts)` e a allowlist (`dev`, `start`, `preview`), na ordem de preferência. `defaultScript` = primeiro de `dev`, `start`, `preview` presente; `null` se nenhum.

### 7.3 Cache e re-scan

- O banco **é** o cache. Scan roda: no boot (assíncrono, não bloqueia o primeiro render), no botão **Escanear**, e após adicionar projeto manual.
- Sem watcher de filesystem no MVP (evita `chokidar` + custo em `C:\Projetos` com `node_modules`).
- `last_scanned_at` exibido em Configurações; se > 10 min, header mostra "dados de X min atrás".
- Git branch/commit são cacheados no scan (30 s de TTL em memória para o detalhe).
- Scan de 7 pastas em profundidade 2: meta < 2 s (sem descer em `node_modules`); timeout global de 10 s cancela e retorna o que já foi coletado.
---

## 8. Estrutura de arquivos

```
C:\Projetos\dashboard-localhost\
├─ .agents/  .opencode/              # kit existente — NÃO alterar
├─ .data/                            # gitignored
│  ├─ hub.db  hub.db-wal  hub.db-shm
│  └─ logs/<runId>.log
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx  globals.css
│  │  ├─ page.tsx                    # dashboard (Server Component)
│  │  ├─ projects/[id]/page.tsx      # detalhe
│  │  ├─ settings/page.tsx
│  │  └─ api/
│  │     ├─ health/route.ts
│  │     ├─ projects/route.ts                 # GET, POST
│  │     ├─ projects/scan/route.ts            # POST
│  │     ├─ projects/[id]/route.ts            # PATCH, DELETE
│  │     ├─ projects/[id]/start/route.ts      # POST
│  │     ├─ projects/[id]/stop/route.ts       # POST
│  │     ├─ projects/[id]/status/route.ts     # GET
│  │     ├─ runs/[runId]/route.ts             # GET
│  │     └─ runs/[runId]/stream/route.ts      # SSE
│  ├─ components/
│  │  ├─ project-card.tsx  project-grid.tsx   # client (estado/polling)
│  │  ├─ status-dot.tsx  stack-badges.tsx
│  │  ├─ start-stop-button.tsx  scan-button.tsx
│  │  ├─ add-project-dialog.tsx  edit-project-dialog.tsx
│  │  ├─ log-viewer.tsx  run-history.tsx  empty-state.tsx
│  │  └─ ui/ (button, badge, dialog, input, tooltip, skeleton)
│  ├─ lib/
│  │  ├─ shared/{types.ts,format.ts,constants.ts}
│  │  ├─ validation/{project.ts,run.ts}
│  │  └─ server/
│  │     ├─ config.ts               # env + defaults + allowlists
│  │     ├─ errors.ts               # AppError + mapeamento HTTP
│  │     ├─ http.ts                 # json(), handle() wrapper
│  │     ├─ db/{index.ts,driver.ts,migrations.ts,schema.sql}
│  │     ├─ repos/{projects.ts,runs.ts}
│  │     ├─ discovery/{scan.ts,stack.ts,package-manager.ts,git.ts,ignore.ts}
│  │     ├─ process/{manager.ts,runner.ts,command.ts,kill.ts,ports.ts,env.ts,reconcile.ts}
│  │     └─ logs/{ring-buffer.ts,log-file.ts,ansi.ts,sse.ts}
│  └─ types/ (dto.ts)
├─ tests/
│  ├─ unit/{parse-port,paths,scripts,stack,ring-buffer}.test.ts
│  ├─ integration/{projects,scan,start-stop}.test.ts
│  └─ helpers/{temp-db.ts,fixtures.ts}
├─ e2e/{dashboard.spec.ts,process.spec.ts,logs.spec.ts}
├─ .fixtures/workspace/              # workspace isolado p/ testes
│  ├─ demo-node/{package.json,server.mjs}
│  ├─ demo-broken/package.json       # JSON inválido
│  └─ Motor de Conteúdo/             # nome com espaço/acento
├─ public/
├─ next.config.ts  tsconfig.json  postcss.config.mjs
├─ vitest.config.ts  playwright.config.ts
├─ eslint.config.mjs  .gitignore  .env.local  README.md
└─ package.json
```

Regras de camada: `app/**` pode importar `lib/server/**` apenas em server components/handlers; `components/**` nunca importa `lib/server/**`; `lib/shared/**` é isomórfico e sem `node:*`.

---

## 9. Fases de implementação

Ordem obrigatória: **F0 → F1 → F2 → F3 → F4 → F5**. F2 depende de F1; F3 e F4 são sequenciais (F4 consome os streams de F3). F5 fecha tudo.

### F0 — Fundação (base executável)

| # | Tarefa | Agente / skill | Depende |
|---|---|---|---|
| 0.1 | `git init`, branch `feat/mvp-hub`, `.gitignore` (`.data/`, `node_modules`, `.next`) | devops-engineer | — |
| 0.2 | Setup manual Next 16 + TS strict + Tailwind v4 + ESLint (sem `create-next-app`, ver §12) | frontend-specialist | 0.1 |
| 0.3 | `config.ts`: raiz, allowlists, limites, porta 3100 | backend-specialist | 0.2 |
| 0.4 | `db/driver.ts` + `migrations.ts` (v1: 2 tabelas) + `migrate()` idempotente | database-architect / @database-design | 0.3 |
| 0.5 | `errors.ts`, `http.ts`, `GET /api/health` | backend-specialist / @api-patterns | 0.4 |
| 0.6 | Shell visual: layout, tema escuro, header, `/` com empty state estático | frontend-specialist / @frontend-design | 0.2 |

**Aceite F0**
- [ ] `npm run dev` responde `http://localhost:3100` com 200.
- [ ] `curl.exe -s http://localhost:3100/api/health` → `{"ok":true,"db":"ok"}`.
- [ ] `.data/hub.db` criado; `PRAGMA user_version` = 1; reabrir não reaplica migração.
- [ ] `npm run lint` e `npm run typecheck` sem erros.
- [ ] Nenhum arquivo em `.agents/` ou `.opencode/` modificado (`git status` limpo fora do esperado).

### F1 — Descoberta + persistência

| # | Tarefa | Agente / skill | Depende |
|---|---|---|---|
| 1.1 | `discovery/ignore.ts` + `scan.ts` (profundidade 1, skip list, symlinks, self-exclude) | backend-specialist | F0 |
| 1.2 | `stack.ts`, `package-manager.ts`, `git.ts`; tolerância a BOM/JSON inválido/acentos | backend-specialist | 1.1 |
| 1.3 | `repos/projects.ts`: upsert transacional, regras de precedência (scan vs manual) | database-architect | 1.1 |
| 1.4 | `POST /api/projects/scan` + `GET /api/projects` (DTO com `runnableScripts`) | backend-specialist | 1.3 |
| 1.5 | Unit tests: parser/stack/allowlist/paths + fixture de workspace | test-engineer / @testing-patterns | 1.2 |
| 1.6 | `POST /api/projects` (manual), `PATCH`, `DELETE` (hide/hard) | backend-specialist | 1.4 |

**Aceite F1**
- [ ] `POST /api/projects/scan` retorna `added: 7` (5 `node`, 2 `non-node`) na primeira execução.
- [ ] Com `prenatal-saas` (workspace pnpm), o scan adiciona `apps/api`, `apps/web`, `packages/db`, `packages/ig-dpp` com `parent_id` apontando para `prenatal-saas`, mesmo estando a 3 níveis de `C:\Projetos`, e não desce em `node_modules`/`.next`.
- [ ] `GET /api/projects` inclui `Motor de Conteúdo do Instagram` com nome legível e `kind: "non-node"`.
- [ ] `prenatal-saas` aparece com `runnableScripts: []` (sem `dev`/`start`).
- [ ] Raiz extra em `HUB_PROJECTS_ROOTS` é escaneada; raiz fora da allowlist do body → 403 `PATH_NOT_ALLOWED`.
- [ ] Segundo scan → `added: 0, unchanged: 7`; duração < 2 s.
- [ ] `dashboard-localhost` não aparece na lista (self-exclude).
- [ ] `preferred_port`/`notes`/`hidden` de um projeto de scan sobrevivem a novo scan.
- [ ] `npm run test` verde (≥ 15 casos, incluindo BOM, JSON inválido, nome acentuado).
- [ ] `POST /api/projects` com `..\..\Windows` → 403 `PATH_NOT_ALLOWED`.

### F2 — UI de inventário

| # | Tarefa | Agente / skill | Depende |
|---|---|---|---|
| 2.1 | Grid + card (stack, branch, porta, última atividade) + badges + estado vazio/skeleton | frontend-specialist / @ui-styling | F1 |
| 2.2 | Botão Escanear com progresso/resultado; revalidação após scan | frontend-specialist | 2.1 |
| 2.3 | Detalhe do projeto: dados, scripts, últimos runs; link `localhost:porta` | frontend-specialist | 2.1 |
| 2.4 | Dialogs adicionar/editar/ocultar + toasts de erro mapeados (§6.9) | frontend-specialist | 2.3 |
| 2.5 | Filtros (todos/rodando/ocultos) + contadores no header | frontend-specialist | 2.1 |

**Aceite F2**
- [x] Dashboard renderiza 11 projetos do inventário: 10 cards (6 projetos + 4 pacotes) mais a linha do workspace `prenatal-saas`.
- [ ] Estado vazio aparece com banco limpo e CTA dispara scan (estado vazio validado pela busca sem resultado; falta o caso de banco vazio).
- [x] Ocultar um projeto remove do grid; "mostrar ocultos" o traz de volta; persiste após reload.
- [x] Adicionar projeto manual por caminho cria card e sobrevive a scan (validado com raiz extra em `HUB_PROJECTS_ROOTS`, sem poluir `C:\Projetos`).
- [x] `Motor de Conteúdo do Instagram` renderiza sem quebrar layout nem encoding.
- [x] `npm run build` conclui sem erro; contraste conferido visualmente (AA), Lighthouse não rodado.

> Evidência (2026-10-20, `npm run dev` em 3100): 13/13 checagens de UI via Playwright (erros 403/409 nos dialogs, edição de notas, ocultar/reexibir, busca) e 8/9 checagens de API (403 em raiz fora da allowlist, criação/remoção manual). `typecheck`, `lint` e `build` limpos.

### F3 — Controle de processos

| # | Tarefa | Agente / skill | Depende |
|---|---|---|---|
| 3.1 | `command.ts` (runner por package manager, validação de script) + unit tests | backend-specialist / @nodejs-best-practices | F1 |
| 3.2 | `kill.ts` (validação de PID + `taskkill /T /F`) + testes com processo decoy | security-auditor | 3.1 |
| 3.3 | `ports.ts` (parser, listeners, árvore de PIDs) + unit tests | backend-specialist | 3.1 |
| 3.4 | `manager.ts` + `runner.ts`: spawn, ring buffer stub, estado, lock por projeto | backend-specialist | 3.2, 3.3 |
| 3.5 | `reconcile.ts` no boot + shutdown handlers + `.env` do filho | backend-specialist | 3.4 |
| 3.6 | Rotas `start`/`stop`/`status` + botões e polling na UI | backend-specialist + frontend-specialist | 3.4 |
| 3.7 | Revisão de segurança da seção 6 (checklist assinado) | security-auditor / @vulnerability-scanner | 3.6 |

**Aceite F3**
- [x] Iniciar `demo-node` → `status: running`, porta detectada, PID registrado, listener na porta.
- [x] Parar → nenhum listener na porta e nenhum processo remanescente (`Get-CimInstance Win32_Process` filtrado).
- [ ] Iniciar `trustcare` → porta 3000 detectada e log inicial capturado; se 3000 estiver ocupada, 409 informativo (sem troca automática de porta).
- [x] Iniciar `prenatal-saas` → 422 `NO_SCRIPT`; botão desabilitado na UI. _(validado com fixture `demo-nonrun`)_
- [x] Segundo `start` no mesmo projeto → 409 `ALREADY_RUNNING`.
- [x] Listener decoy em porta alvo → 409 `PORT_IN_USE`, decoy **continua vivo**.
- [ ] `Ctrl+C` no hub com 2 runs ativas → 0 listeners órfãos.
- [x] Matar o hub com `Stop-Process -Force` e reabrir → runs antigas viram `crashed`, nada é morto no boot.
- [x] `start` com body `{"script":"dev && calc"}` → 422, nenhum processo criado.

> Verificado em 21/10/2026 com fixture isolada (`demo-node` em 4321 + `demo-nonrun`, `HUB_PROJECTS_ROOTS` temporário). Falta validar `trustcare` real e o shutdown por `Ctrl+C`.

**Checklist de segurança F3 (§6.2)**
- [x] C1 — `resolveAllowedPath` roda antes do spawn (403 `PATH_NOT_ALLOWED`).
- [x] C2 — script validado por regex + allowlist + existência no `package.json` (422).
- [x] C3 — API só aceita `{ script }`; nenhum comando/argumento vem do cliente.
- [x] C4 — `spawn` com `shell: false`; template fixo `cmd.exe /d /s /c <runner> run <script>`.
- [x] C5 — lock em memória por projeto + índice único parcial `idx_runs_one_active`.
- [x] C6 — kill só na árvore (`taskkill /T /F`) após validar `CreationDate`; PID reciclado aborta.
- [x] C7 — pré-checagem de porta; listener externo gera 409 e permanece vivo (decoy testado).
- [x] C8 — `SIGINT`/`SIGTERM`/`exit` → kill síncrono; boot reconcilia sem matar (`ORPHAN_RECONCILED`).
- [x] C9 — `buildChildEnv` remove `PORT`/`NODE_OPTIONS`/`NEXT_RUNTIME`/`__NEXT_PRIVATE_*`; DTO não expõe env.

### F4 — Logs e streaming

| # | Tarefa | Agente / skill | Depende |
|---|---|---|---|
| 4.1 | `ring-buffer.ts` (1000 linhas/256 KB, seq) + unit tests de limite | backend-specialist | F3 |
| 4.2 | `log-file.ts` (append com cap 5 MB) + `ansi.ts` | backend-specialist | 4.1 |
| 4.3 | `sse.ts` + `GET /api/runs/:runId/stream` (Last-Event-ID, ping, end) | backend-specialist | 4.1 |
| 4.4 | `GET /api/runs/:runId` (histórico) + `log-viewer.tsx` no detalhe | frontend-specialist | 4.3 |
| 4.5 | Toolbar do log: pausar, copiar, baixar, auto-scroll inteligente | frontend-specialist | 4.4 |

**Aceite F4**
- [ ] Com run ativa, linha nova aparece no viewer em ≤ 2 s.
- [ ] `curl.exe -N http://localhost:3100/api/runs/<id>/stream` emite `event: log` e `event: status`.
- [ ] Fechar e reabrir o detalhe reexibe o histórico do run atual (sem perder linhas).
- [ ] Após `stop`, `event: end` chega e o botão volta para "Iniciar".
- [ ] Buffer nunca excede 1000 linhas (teste unitário) e o arquivo de log é truncado em 5 MB.
- [ ] Códigos ANSI não aparecem no viewer.
- [ ] Scroll manual pausa auto-scroll; botão "ir para o fim" retoma.

### F5 — Polimento, testes e hardening

| # | Tarefa | Agente / skill | Depende |
|---|---|---|---|
| 5.1 | Integração: handlers com DB temporária (`HUB_DATA_DIR`) | test-engineer | F4 |
| 5.2 | E2E Playwright com workspace fixture isolado em porta 3199 | qa-automation-engineer / @webapp-testing | 5.1 |
| 5.3 | Página Configurações (limites read-only, limpar histórico, re-scan) | frontend-specialist | F2 |
| 5.4 | Tratamento de erros global + toasts + estados `missing`/`port-in-use` | frontend-specialist | F3 |
| 5.5 | Acessibilidade (foco, aria-live, contraste) + responsivo | frontend-specialist | 5.4 |
| 5.6 | Security scan + revisão de path traversal/command injection | security-auditor | 5.1 |
| 5.7 | README (setup, env, limites, troubleshooting) | documentation-writer | 5.2 |

**Aceite F5**
- [ ] `npm run lint` → 0 erros; `npx tsc --noEmit` → 0 erros.
- [ ] `npm run test` → todos os unit/integração verdes; cobertura ≥ 85% em `discovery`, `process/ports`, `process/command`, `process/kill`.
- [ ] `npm run test:e2e` → 4 cenários verdes (empty→scan, iniciar/parar, log ao vivo, porta ocupada).
- [ ] Nenhum projeto real é iniciado nos testes (workspace fixture).
- [ ] `python .agents/skills/vulnerability-scanner/scripts/security_scan.py .` sem achados críticos/altos.
- [ ] README cobre bootstrap, env e o que fazer com porta ocupada/processo órfão.

### Caminho crítico

```
F0 (0.1→0.4→0.5) ─┬─> F1 (1.1→1.3→1.4) ─> F2 ─┐
                  └─> F3 (3.1→3.2/3.3→3.4) ───┼─> F4 ─> F5
```

Paralelizável: 1.5 com 1.4; 0.6 com 0.4/0.5; 5.3 com 5.1; 5.6 com 5.2.

---

## 10. Estratégia de testes

### 10.1 Pirâmide

| Nível | Ferramenta | Alvo | Quantidade alvo |
|---|---|---|---|
| Unit | Vitest | parsers, allowlists, stack, ring buffer, path guard | 25–35 |
| Integração | Vitest + handlers (`new Request`) | rotas com DB temporária | 10–15 |
| E2E | Playwright (Chromium) | fluxo real com fixture | 3–5 |

### 10.2 Casos obrigatórios

**Unit — descoberta/segurança**
- `parsePortFromLine`: Next (`- Local: http://localhost:3000`), Vite, `started server on 0.0.0.0:3002`, `ready in 3002ms` (não deve casar), texto sem porta.
- `parseScriptPort`: `next dev -p 3002`, `next dev --port=3005`, `vite --port 5173`, ausência.
- `resolveAllowedPath`: `C:\Projetos\x` ok; `C:\Projetos\..\Windows` 403; `\\server\share` 403; junction para fora 403; case-insensitive (`c:\projetos\TrustCare`).
- `isScriptAllowed`: `dev` ok; `dev && calc` 422; `postinstall` 422; `dev ` (espaço) 422.
- `detectStack`: Next/React/Tailwind; Vite+React; sem package.json.
- `readPackageJson`: BOM (EF BB BF), JSON inválido, `name` ausente, acentos no path.
- `RingBuffer`: insere 1500 → mantém 1000; bytes limitados; `seq` monotônico.

**Integração**
- Scan idempotente: 1ª → 7 adicionados; 2ª → 0 adicionados.
- Precedência: `hidden`/`notes` preservados em re-scan; projeto manual não vira `scan`.
- `start` em projeto sem script → 422; em projeto já ativo → 409.
- `DELETE` (hide) mantém linha; `?hard=1` remove e cascata em runs.
- `GET /status` sem run → `run: null` (nunca 404).

**E2E (workspace `.fixtures/workspace`, porta 3199, `HUB_DATA_DIR` temp)**
1. Empty state → Scan → 3 cards (demo-node, demo-broken, "Motor de Conteúdo").
2. Iniciar `demo-node` → dot verde, porta visível → Parar → dot cinza, porta liberada.
3. Log ao vivo: iniciar → texto "fixture ready" aparece < 2 s → pausar → linha nova não rola.
4. Porta ocupada: subir decoy em 4100 → iniciar projeto configurado para 4100 → banner de porta ocupada → decoy vivo.

### 10.3 Comandos de verificação

```powershell
npm run lint
npx tsc --noEmit
npm run test
npm run test:e2e
npm run build
python .agents/skills/vulnerability-scanner/scripts/security_scan.py .
```

`playwright.config.ts`: `webServer.command = "npx next dev -p 3199"` (a porta não vem do `npm run dev`, que é fixo em 3100), `env: { HUB_DATA_DIR: ".data/test", HUB_PROJECTS_ROOT: ".fixtures/workspace" }`, `reuseExistingServer: false`; `globalTeardown` mata processos fixture em 4100/4101.

`vitest.config.ts`: `environment: "node"`, `resolve.alias: { "@": "./src" }`, `test.include: ["tests/**/*.test.ts"]` e `test.exclude: ["e2e/**", "node_modules/**"]`.

---

## 11. Riscos e mitigação

| # | Risco | Prob. | Impacto | Mitigação | Detecção |
|---|---|---|---|---|---|
| R1 | Processo órfão após fechar/crashar o hub | Alta | Alto | `taskkill /T /F` no shutdown; reconciliação no boot; `HUB_RUN_ID` no env | `Get-NetTCPConnection` na porta do run |
| R2 | `taskkill` matar processo errado (PID reciclado) | Média | Crítico | validar `CreationDate` ±2 s antes de matar; kill só da árvore do PID raiz | teste com decoy + log de auditoria |
| R3 | Path traversal / junction para fora da raiz | Média | Crítico | `realpath` + `path.relative` + allowlist; nunca concatenar path em comando | unit tests de `resolveAllowedPath` |
| R4 | Command injection via nome de script | Baixa | Crítico | allowlist fechada + regex + existência no package.json + sem `shell:true` | fuzz de scripts no unit test |
| R5 | Porta ocupada e usuário quer "só matar" | Alta | Médio | 409 informativo com PID/nome; sem botão de kill externo | UI mostra owner `external` |
| R6 | Nomes com acento/espaço quebram execução | Média | Alto | `cwd` no spawn (sem string), `execFile` com args array, UTF-8 no scan; project `Motor de Conteúdo...` no fixture | E2E com nome acentuado |
| R7 | Windows Defender/antivírus bloqueia spawn de `cmd.exe`/`node` | Média | Alto | `windowsHide`, executáveis conhecidos, documentar exclusão da pasta; erro `SPAWN_FAILED` claro | log de `error` do child |
| R8 | SQLite `SQLITE_BUSY` / lock | Baixa | Médio | WAL + `busy_timeout=5000` + conexão única + transações curtas | health check e logs |
| R9 | HMR do Next zera estado em memória | Alta (dev) | Alto | singleton em `globalThis` + estado durável no DB + reconciliação | teste manual de reload com run ativa |
| R10 | `better-sqlite3` sem prebuild no Node 24 | Média | Alto | conferir instalação; fallback `node:sqlite` via `driver.ts` | `npm i` e `GET /health` |
| R11 | 8 dev servers simultâneos travam a máquina | Média | Alto | `HUB_MAX_RUNNING=4` + botão desabilitado com aviso | contador de runs ativos |
| R12 | Porta desconhecida (script silencioso) | Média | Baixo | fallback listeners por árvore de PID; campo `preferred_port`; UI "porta desconhecida" | parser sem match |
| R13 | Log infinito estoura memória/disco | Média | Médio | ring buffer + cap de 5 MB no arquivo | teste de limite |
| R14 | Monorepo (`prenatal-saas`) confundir detecção | Média | Baixo | `runnableScripts` derivado do package.json raiz; sem `dev` → não iniciável; profundidade 2 opt-in | aceite F1 |
| R15 | Scan lento por `node_modules` | Alta se mal feito | Médio | skip list + profundidade 1 + timeout por diretório | `durationMs` do scan |

---

## 12. Bootstrap (passo a passo)

`create-next-app` **não** deve ser usado aqui: a pasta já contém `.agents/` e `.opencode/` e o CLI aborta em diretório não vazio. Setup manual, determinístico.

```powershell
cd C:\Projetos\dashboard-localhost

# 1. Git (repo ainda não existe)
git init -b main
git checkout -b feat/mvp-hub

# 2. package.json base
npm init -y

# 3. Dependências de runtime
npm i next@16 react@19.2.0 react-dom@19.2.0 better-sqlite3 zod lucide-react clsx

# 4. Dependências de desenvolvimento
npm i -D typescript @types/node @types/react @types/react-dom @types/better-sqlite3 `
  tailwindcss @tailwindcss/postcss postcss `
  eslint eslint-config-next `
  vitest @playwright/test

# 5. Browsers do Playwright
npx playwright install chromium
```

`package.json` (trecho a ajustar):

```json
{
  "name": "dashboard-localhost",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3100",
    "build": "next build",
    "start": "next start -p 3100",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Configurações mínimas:

```ts
// next.config.ts
import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
};
export default config;
```

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```css
/* src/app/globals.css */
@import "tailwindcss";
```

```json
// tsconfig.json (essencial)
{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true, "target": "ES2022",
  "module": "ESNext", "moduleResolution": "Bundler", "jsx": "preserve",
  "paths": { "@/*": ["./src/*"] }, "plugins": [{ "name": "next" }] } }
```

`.env.local` (não versionar; criar `.env.example`):

```ini
HUB_PROJECTS_ROOT=C:\Projetos
HUB_DATA_DIR=.data
HUB_ALLOWED_SCRIPTS=dev,start,preview
HUB_BOOT_TIMEOUT_MS=90000
HUB_MAX_RUNNING=4
HUB_LOG_BUFFER_LINES=1000
```

`.gitignore`:

```
node_modules/
.next/
.data/
.env.local
test-results/
playwright-report/
```

Validação do bootstrap:

```powershell
npm run typecheck
npm run lint
npm run dev        # http://localhost:3100
curl.exe -s http://localhost:3100/api/health
git add -A; git commit -m "chore: bootstrap Next.js + Tailwind + SQLite foundation"
```

---

## Phase X — Verificação final

Executar **nesta ordem**, com o hub rodando em `http://localhost:3100`:

1. **Estático**
   ```powershell
   npm run lint
   npx tsc --noEmit
   npm run build
   ```
2. **Testes**
   ```powershell
   npm run test
   npm run test:e2e
   ```
3. **Segurança**
   ```powershell
   python .agents/skills/vulnerability-scanner/scripts/security_scan.py .
   ```
4. **Manual — inventário**
   - Scan retorna 7 projetos (5 node, 2 non-node, 4 iniciáveis).
   - `Motor de Conteúdo do Instagram` e `prenatal-saas` renderizam corretamente.
   - Ocultar/adicionar/editar persistem após reload e novo scan.
5. **Manual — processos (a parte que importa)**
   - Iniciar `trustcare` → abrir `localhost:3000` funciona; log aparece ao vivo.
   - Parar → `Get-NetTCPConnection -LocalPort 3000 -State Listen` sem resultado.
   - Subir decoy em 4100, iniciar projeto na 4100 → 409 informativo, decoy intacto.
   - `Ctrl+C` no hub → nenhum `node.exe` filho remanescente.
6. **Regras de projeto**
   - [ ] Sem roxo/violeta em hex ou classe Tailwind.
   - [ ] Nenhum comando livre aceito na API (grep por `shell: true`, `exec(`, `execSync(`).
   - [ ] Nenhum segredo em log ou resposta da API.
   - [ ] `.agents/` e `.opencode/` intactos.

Modelo do marcador — copiar para o fim deste arquivo **somente após** executar todos os passos acima:

```markdown
## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Types: ✅ Pass
- Unit/Integration: ✅ Pass
- E2E: ✅ Pass
- Security: ✅ Sem achados críticos/altos
- Build: ✅ Success
- Data: 20/10/2026
```