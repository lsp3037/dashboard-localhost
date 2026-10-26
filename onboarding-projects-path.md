# Implementação: Onboarding e Seleção de Pastas de Projetos

## Objetivo
Criar uma experiência de Onboarding na primeira execução do Dashboard Localhost, permitindo que qualquer desenvolvedor selecione facilmente a pasta raiz (ou múltiplas pastas e subpastas) de seus projetos no seu sistema de arquivos (Windows/Linux/macOS), persistindo essa configuração no banco SQLite e disparando a primeira varredura automaticamente.

---

## Arquitetura & Decisões Técnicas

1. **Persistência Dinâmica (`hub_settings` no SQLite)**
   - Criar Migration v3 no SQLite: tabela `hub_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`.
   - Chaves: `projects_roots` (JSON array de caminhos absolutos), `scan_depth` (1 ou 2), `onboarding_completed` (boolean).
   - A camada `config.ts` passa a priorizar as configurações salvas no banco, utilizando as variáveis de ambiente (`process.env`) como fallback inicial.

2. **API de Navegação no Sistema de Arquivos (`/api/system/directories`)**
   - Como o navegador não consegue ler o sistema de arquivos completo do host por restrições de sandbox, criamos um endpoint local seguro:
     - Sem parâmetro ou com drive raiz: lista drives lógicos no Windows (`C:\`, `D:\`) e diretório home do usuário.
     - Com parâmetro `?path=...`: lista subpastas imediatas (filtrando pastas ocultas, sistema, `node_modules` e `.git`).
     - Suporta validação de existência de pastas e permissões de leitura.

3. **API de Onboarding & Configurações (`/api/settings`)**
   - `GET /api/settings`: Retorna status do onboarding (`completed: boolean`), raízes atuais e scan depth.
   - `POST /api/settings/onboarding`: Valida as pastas selecionadas, salva no banco SQLite, marca `onboarding_completed: true` e dispara o scan inicial.

4. **Interface do Usuário (Frontend)**
   - **Componente `DirectoryPicker`**: Navegador de pastas interativo com breadcrumbs, listagem rápida de subpastas, botão de selecionar/desmarcar pasta, e campo de digitação/colagem de caminho com validação.
   - **Fluxo de Onboarding (`OnboardingWizard` / Modal)**:
     - Apresentado automaticamente na home (`/`) quando `onboarding_completed === false` e nenhuma raiz customizada estiver definida.
     - Permite escolher 1 ou mais pastas raízes e definir a profundidade de varredura (1 ou 2 níveis).
     - Botão "Salvar e Iniciar Varredura" que faz a transição suave para o inventário com os projetos descobertos.
   - **Página de Configurações (`/settings`)**:
     - Deixa de ser "somente leitura" para as raízes: permite que o usuário adicione ou remova pastas a qualquer momento posterior.

---

## Organização dos Subagentes (Orquestração Mínima de 3 Agentes)

| Subagente | Domínio / Responsabilidade | Tarefas Específicas |
|---|---|---|
| **backend-specialist** | Backend, SQLite e APIs | - Migration v3 (`hub_settings`)<br>- Repositório `settings.ts`<br>- Atualização de `config.ts` (DB fallback para ENV)<br>- Endpoint `GET /api/system/directories`<br>- Endpoint `POST /api/settings/onboarding` |
| **frontend-specialist** | Interface do Usuário (Next.js/React/Tailwind) | - Componente `DirectoryPicker` (navegação em árvore/pastas)<br>- Componente `OnboardingDialog` / Wizard<br>- Integração na Home (`page.tsx`) e página `/settings` para edição posterior |
| **test-engineer** | Qualidade, Testes e Verificação | - Testes unitários para `directories.ts` e `settings repo`<br>- Testes de integração para a rota de onboarding<br>- Execução da suíte completa de testes (`npm test`) e linting |

---

## Tarefas do Plano

- [x] **Task 1 (Backend)**: Migration v3 (`hub_settings`) e repositório `src/lib/server/repos/settings.ts` → *Verificado: migrate() roda com sucesso e testes de read/write no SQLite passam.*
- [x] **Task 2 (Backend)**: Integrar leitura do banco em `src/lib/server/config.ts` e `overview.ts` com fallback para ENV → *Verificado: getConfig() retorna raízes do DB se existirem e detecta needsOnboarding.*
- [x] **Task 3 (Backend)**: Criar rota `GET /api/system/directories` para navegação segura de drives e pastas → *Verificado: navegação de drives e subpastas locais no host validada.*
- [x] **Task 4 (Backend)**: Criar rotas `GET /api/settings` e `POST /api/settings/onboarding` → *Verificado: chamada POST persiste raízes e status de onboarding no SQLite e dispara scan inicial.*
- [x] **Task 5 (Frontend)**: Construir componente `DirectoryPicker` com navegação de diretórios, seleção múltipla e input manual → *Verificado: navegação fluida entre pastas e subpastas com breadcrumbs e drives.*
- [x] **Task 6 (Frontend)**: Criar modal/tela de `Onboarding` e plugar no carregamento da Home (`/`) → *Verificado: primeira visita exibe tela de onboarding; após concluir, exibe inventário.*
- [x] **Task 7 (Frontend)**: Atualizar `/settings` para permitir gerenciar e reconfigurar pastas raízes sem reiniciar o hub → *Verificado: usuário consegue adicionar/remover pastas pelas configurações via ManageRootsDialog.*
- [x] **Task 8 (Testes & Validação)**: Implementar testes com Vitest cobrindo a API de diretórios, migração e configurações; executar `npm run lint` e `npm test` → *Verificado: 57/57 testes passando e ESLint sem erros.*

---

## Critérios de Sucesso ("Done When")
- [x] O primeiro acesso à aplicação (ou quando nenhuma pasta estiver configurada) apresenta a tela de onboarding de forma clara e amigável.
- [x] O desenvolvedor consegue navegar pelas unidades/pastas do computador dele e selecionar sua pasta de projetos (mesmo que seja diferente de `C:\Projetos`).
- [x] As pastas selecionadas são salvas no banco SQLite local.
- [x] A varredura de projetos é executada imediatamente nas pastas escolhidas.
- [x] O usuário pode alterar as pastas a qualquer momento na página de Configurações.
- [x] Todos os testes unitários e de integração passam sem regressões.
