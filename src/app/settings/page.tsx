import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ManageRootsDialog } from '@/components/manage-roots-dialog';
import { ScanButton } from '@/components/scan-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { loadSettings } from '@/lib/server/overview';
import { formatBytes, formatCount, formatDurationMs } from '@/lib/shared/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Configurações',
};

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-hub-border bg-hub-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hub-border px-3 py-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-hub-text-muted">{title}</h2>
          <span className="font-mono text-[10px] text-hub-text-muted/70">{description}</span>
        </div>
        {action && <div>{action}</div>}
      </header>
      {children}
    </section>
  );
}

function Row({ label, env, children }: { label: string; env: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-hub-border px-3 py-2 last:border-b-0">
      <dt className="text-[11px] uppercase tracking-[0.08em] text-hub-text-muted">{label}</dt>
      <dd className="flex min-w-0 items-baseline gap-2 text-right">
        <span className="min-w-0 break-words font-mono text-[12px] text-hub-text">{children}</span>
        <code className="hidden shrink-0 font-mono text-[10px] text-hub-text-muted/60 md:inline">{env}</code>
      </dd>
    </div>
  );
}

export default function SettingsPage() {
  const { config, projectCount, lastScanLabel, lastScanTitle } = loadSettings();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-7 tracking-tight text-hub-text">Configurações</h1>
          <p className="mt-0.5 max-w-prose text-[12px] leading-5 text-hub-text-muted">
            Pastas raízes e profundidade de varredura podem ser editadas diretamente aqui. Demais parâmetros de processo refletem as variáveis de ambiente (<code className="whitespace-nowrap font-mono">.env</code>).
          </p>
        </div>
        <ScanButton variant="secondary" label="Re-scan" />
      </div>

      {/* Seção de Destaque: Reconfiguração Sempre Visível de Pastas e Varredura */}
      <div className="rounded-sm border border-hub-border-strong bg-hub-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-hub-accent" aria-hidden="true" />
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-hub-text">
                Pastas de Projetos & Nível de Varredura
              </h2>
            </div>
            <p className="text-[12px] leading-5 text-hub-text-muted">
              Configure as pastas onde seus projetos estão localizados e a profundidade da varredura. Se o nível selecionado capturou subpastas indesejadas (ex: monorepos ou pacotes internos), você pode redefinir aqui e limpar o inventário a qualquer momento.
            </p>
          </div>
          <ManageRootsDialog
            roots={config.projectsRoots}
            scanDepth={config.scanDepth}
            variant="primary"
            size="md"
            label="Reconfigurar Pastas e Nível"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-hub-border pt-3 sm:grid-cols-2 text-[11px] font-mono">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-hub-text-muted">Pastas Ativas</span>
            <span className="text-hub-text font-medium truncate" title={config.projectsRoots.join('; ')}>
              {config.projectsRoots.join('; ')}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 sm:text-right">
            <span className="text-[10px] uppercase tracking-wider text-hub-text-muted">Profundidade Atual</span>
            <span className="text-hub-text font-medium">
              {config.scanDepth === 1 ? '1 Nível (somente raiz direta)' : '2 Níveis (varre subpastas e workspaces)'}
            </span>
          </div>
        </div>
      </div>

      <Section
        title="Descoberta"
        description="scan"
        action={<ManageRootsDialog roots={config.projectsRoots} scanDepth={config.scanDepth} label="Alterar" />}
      >
        <dl>
          <Row label="Raízes monitoradas" env="HUB_PROJECTS_ROOTS">
            <span className="flex flex-col items-end gap-0.5">
              {config.projectsRoots.map((root) => (
                <span key={root} className="block max-w-full truncate" title={root}>
                  {root}
                </span>
              ))}
            </span>
          </Row>
          <Row label="Profundidade" env="HUB_SCAN_DEPTH">
            {config.scanDepth} {config.scanDepth === 1 ? 'nível' : 'níveis'} (workspaces expandidos além disso)
          </Row>
          <Row label="Projetos no inventário" env="sqlite">
            {formatCount(projectCount)}
          </Row>
          <Row label="Última varredura" env="projects.last_scanned_at">
            <span title={lastScanTitle ?? undefined}>{lastScanLabel ?? 'nunca'}</span>
          </Row>
          <Row label="Timeout do scan" env="HUB_SCAN_TIMEOUT_MS">
            {formatDurationMs(config.scanTimeoutMs)}
          </Row>
        </dl>
        <p className="border-t border-hub-border px-3 py-2 text-[11px] leading-4 text-hub-text-muted">
          O scan ignora <code className="font-mono">node_modules</code>, <code className="font-mono">.git</code> e pastas de
          build. O botão acima varre todas as raízes e mantém o que você editou à mão.
        </p>
      </Section>

      <Section title="Execução" description="processos">
        <dl>
          <Row label="Scripts permitidos" env="HUB_ALLOWED_SCRIPTS">
            <span className="flex flex-wrap justify-end gap-1">
              {config.allowedScripts.map((script) => (
                <Badge key={script} tone="accent">
                  {script}
                </Badge>
              ))}
            </span>
          </Row>
          <Row label="Runs simultâneos" env="HUB_MAX_RUNNING">
            {formatCount(config.maxRunning)}
          </Row>
          <Row label="Timeout de boot" env="HUB_BOOT_TIMEOUT_MS">
            {formatDurationMs(config.bootTimeoutMs)}
          </Row>
          <Row label="Carência no stop" env="HUB_STOP_GRACE_MS">
            {formatDurationMs(config.stopGraceMs)}
          </Row>
        </dl>
        <p className="border-t border-hub-border px-3 py-2 text-[11px] leading-4 text-hub-text-muted">
          Scripts fora da allowlist nunca são executados. O hub também não aceita script arbitrário vindo da UI.
        </p>
      </Section>

      <Section title="Logs e stream" description="F4 pendente">
        <dl>
          <Row label="Buffer por run" env="HUB_LOG_BUFFER_LINES">
            {formatCount(config.logBufferLines)} linhas
          </Row>
          <Row label="Tamanho máximo do log" env="HUB_LOG_MAX_BYTES">
            {formatBytes(config.logMaxBytes)}
          </Row>
          <Row label="Streams SSE simultâneos" env="HUB_MAX_STREAMS">
            {formatCount(config.maxStreams)}
          </Row>
        </dl>
        <div className="flex flex-wrap items-center gap-2 border-t border-hub-border px-3 py-2">
          <Button
            variant="danger"
            size="sm"
            disabled
            title="Disponível quando a limpeza de histórico for implementada (F4)"
            aria-describedby="clear-history-hint"
          >
            Limpar histórico de runs
          </Button>
          <span id="clear-history-hint" className="text-[11px] text-hub-text-muted">
            O histórico de execuções já aparece no detalhe do projeto. Logs ao vivo, SSE e limpeza de histórico ficam para a F4.
          </span>
        </div>
      </Section>

      <Section title="Dados do hub" description="local">
        <dl>
          <Row label="Arquivo SQLite" env="HUB_DATA_DIR">
            <span className="break-all">{config.dataDir}</span>
          </Row>
          <Row label="Porta HTTP" env="HUB_PORT">
            {config.port}
          </Row>
        </dl>
        <p className="border-t border-hub-border px-3 py-2 text-[11px] leading-4 text-hub-text-muted">
          O hub escuta apenas em <code className="font-mono">localhost</code>, sem autenticação. Não exponha esta porta na
          rede.
        </p>
      </Section>
    </div>
  );
}
