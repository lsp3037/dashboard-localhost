# Skills, agentes e comandos instalados neste projeto

## 1. Skills

| Origem | Commit | Onde ficou | O que veio |
| --- | --- | --- | --- |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `56ea9cf` | `.opencode/skills/` | 7 skills: `ui-ux-pro-max`, `ui-styling`, `design`, `design-system`, `brand`, `banner-design`, `slides` (com `data/`, `references/`, `scripts/`) |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `dad8dbb` | `.opencode/skills/impeccable/` | `impeccable` + `reference/` e `scripts/` (launcher `impeccable.cmd` para Windows) |
| [vudovn/ag-kit](https://github.com/vudovn/ag-kit) | `549ba3d` | `.agents/skills/` | 47 skills, incluindo `api-patterns`, `architecture`, `clean-code`, `intelligent-routing`, `nextjs-react-expert`, `tailwind-patterns`, `tdd-workflow`, `systematic-debugging`, `vulnerability-scanner` |

O OpenCode descobre `.agents/skills/` nativamente (fonte de compatibilidade de projeto), então as
skills do ag-kit ficam no diretório original do kit — sem cópia duplicada.

## 2. Agentes (`.opencode/agents/`)

Os 20 agentes do ag-kit (`.agents/agent/*.md`) foram convertidos para o formato de agente do
OpenCode, porque o Antigravity os lê de `.agents/agent/` e o OpenCode de `.opencode/agents/`:

- `orchestrator` → `mode: all` (pode ser escolhido como agente principal da sessão)
- os outros 19 → `mode: subagent` (acionados pela ferramenta `subagent`): `backend-specialist`,
  `frontend-specialist`, `mobile-developer`, `game-developer`, `database-architect`, `debugger`,
  `code-archaeologist`, `devops-engineer`, `documentation-writer`, `explorer-agent`,
  `penetration-tester`, `performance-optimizer`, `product-manager`, `product-owner`,
  `project-planner`, `qa-automation-engineer`, `security-auditor`, `seo-specialist`,
  `test-engineer`
- `tools:` do Antigravity virou permissões: quem não tinha `Edit`/`Write` recebeu `edit: deny`;
  quem não tinha `Bash` recebeu `shell: deny`.

## 3. Comandos (`.opencode/commands/`)

Os 13 workflows do kit viraram slash commands: `/brainstorm`, `/coordinate`, `/create`, `/debug`,
`/deploy`, `/enhance`, `/orchestrate`, `/plan`, `/preview`, `/remember`, `/status`, `/test`,
`/verify`.

`/orchestrate` e `/coordinate` já rodam com o agente `orchestrator` na sessão atual.

## 4. Regras e memória

- `.agents/rules/` — regras do kit (`core-protocol`, `universal-rules`, `request-routing`,
  `code-rules`, `design-rules`, `quick-reference`).
- `.opencode/opencode.json` — carrega como `instructions` as três regras `always_on`
  (`core-protocol`, `universal-rules`, `request-routing`). As demais são lidas sob demanda.
- `.agents/memory/` — memória persistente (`MEMORY.md`, `project-conventions`, `tech-decisions`,
  `user-preferences`, `feedback-history`).
- `.agents/ARCHITECTURE.md`, `manifest.json`, `hooks/`, `schemas/` — contrato do kit (usado pelos
  validadores do próprio ag-kit).

## Atualizar

```powershell
$tmp = Join-Path $env:TEMP 'skill-update'
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $tmp | Out-Null

git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git "$tmp/ui-ux-pro-max-skill"
git clone --depth 1 https://github.com/pbakaus/impeccable.git "$tmp/impeccable"
git clone --depth 1 https://github.com/vudovn/ag-kit.git "$tmp/ag-kit"

$proj = "C:\Projetos\dashboard-localhost"
Copy-Item "$tmp/ui-ux-pro-max-skill/.claude/skills/*" "$proj/.opencode/skills" -Recurse -Force
Copy-Item "$tmp/impeccable/.opencode/skills/impeccable" "$proj/.opencode/skills" -Recurse -Force
Remove-Item "$proj/.agents" -Recurse -Force
Copy-Item "$tmp/ag-kit/.agents" $proj -Recurse -Force
```

Depois de atualizar o ag-kit, regenere os agentes e comandos (a conversão é a mesma descrita acima):
frontmatter `description` + `mode` + `permissions`, corpo preservado; workflows com `description` e,
em `orchestrate`/`coordinate`, `agent: orchestrator` + `subagent: false`.

## Remover

- Skill: apague a pasta dentro de `.opencode/skills/` (ou dentro de `.agents/skills/` para ag-kit).
- Agente: apague o arquivo em `.opencode/agents/`.
- Comando: apague o arquivo em `.opencode/commands/`.
