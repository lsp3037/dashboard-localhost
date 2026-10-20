'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { ApiError, patchJson } from '@/lib/client/api';
import { pushToast } from '@/lib/client/hub-events';
import type { ProjectView } from '@/lib/shared/view-model';

interface EditProjectDialogProps {
  project: ProjectView | null;
  onClose: () => void;
}

interface UpdatedProject {
  project: { id: string; name: string };
}

export function EditProjectDialog({ project, onClose }: EditProjectDialogProps) {
  const router = useRouter();
  // O pai passa `key={project.id}`: cada projeto abre com estado próprio, sem efeito de reset.
  const [name, setName] = useState(project?.name ?? '');
  const [notes, setNotes] = useState(project?.notes ?? '');
  const [preferredPort, setPreferredPort] = useState(
    project?.preferredPort !== null && project?.preferredPort !== undefined ? String(project.preferredPort) : '',
  );
  const [defaultScript, setDefaultScript] = useState(project?.defaultScript ?? '');
  const [hidden, setHidden] = useState(project?.hidden ?? false);
  const [errors, setErrors] = useState<{ name?: string; port?: string }>({});
  const [requestError, setRequestError] = useState<{ code: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (project === null) return;

    const nextErrors: { name?: string; port?: string } = {};
    const trimmedName = name.trim();

    if (trimmedName.length === 0) {
      nextErrors.name = 'O nome não pode ficar vazio.';
    }

    const portText = preferredPort.trim();
    let parsedPort: number | null = null;

    if (portText.length > 0) {
      const candidate = Number(portText);
      if (!Number.isInteger(candidate) || candidate < 1 || candidate > 65_535) {
        nextErrors.port = 'Use um número inteiro entre 1 e 65535.';
      } else {
        parsedPort = candidate;
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setRequestError(null);
    setPending(true);

    try {
      const updated = await patchJson<UpdatedProject>(`/api/projects/${project.id}`, {
        name: trimmedName,
        notes: notes.trim().length > 0 ? notes.trim() : null,
        preferredPort: parsedPort,
        defaultScript: defaultScript.length > 0 ? defaultScript : null,
        hidden,
      });

      pushToast({ tone: 'success', title: 'Projeto atualizado', description: updated.project.name });
      onClose();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setRequestError({ code: error.code, message: error.friendlyMessage });
      } else {
        setRequestError({ code: 'UNKNOWN', message: 'Falha inesperada ao salvar as alterações.' });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={project !== null}
      title="Editar projeto"
      description={project?.path}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={pending} aria-busy={pending}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      {project !== null && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field id="edit-name" label="Nome exibido" required error={errors.name ?? null}>
            <Input
              id="edit-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'edit-name-error' : undefined}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="edit-port"
              label="Porta preferida"
              labelHint="vazio = automática"
              error={errors.port ?? null}
              hint="Sugestão de porta; o hub nunca mata um processo para liberá-la."
            >
              <Input
                id="edit-port"
                inputMode="numeric"
                value={preferredPort}
                onChange={(event) => setPreferredPort(event.target.value.replace(/[^0-9]/g, ''))}
                placeholder="3000"
                aria-invalid={errors.port ? true : undefined}
                aria-describedby={errors.port ? 'edit-port-error' : 'edit-port-hint'}
              />
            </Field>

            <Field
              id="edit-script"
              label="Script padrão"
              hint={
                project.runnableScripts.length === 0
                  ? 'Nenhum script dev/start/preview no package.json.'
                  : 'Somente scripts executáveis pela allowlist.'
              }
            >
              <Select
                id="edit-script"
                value={defaultScript}
                disabled={project.runnableScripts.length === 0}
                onChange={(event) => setDefaultScript(event.target.value)}
              >
                <option value="">Automático</option>
                {project.runnableScripts.map((script) => (
                  <option key={script} value={script}>
                    {script}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field id="edit-notes" label="Notas" labelHint={`${notes.length}/4000`} hint="Ficam salvas no banco do hub, não no projeto.">
            <Textarea
              id="edit-notes"
              value={notes}
              maxLength={4000}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Contexto, pendências, comando manual…"
            />
          </Field>

          <label className="flex items-center gap-2 border border-hub-border bg-hub-bg px-2.5 py-2">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(event) => setHidden(event.target.checked)}
              className="h-3.5 w-3.5 shrink-0 accent-hub-accent"
            />
            <span className="text-[12px] text-hub-text">Ocultar do dashboard</span>
            <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-hub-text-muted">
              sai do grid
            </span>
          </label>

          {requestError && (
            <div role="alert" className="border border-status-error/50 bg-status-error/5 px-2.5 py-2">
              <p className="text-[12px] leading-4 text-status-error">{requestError.message}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-hub-text-muted">
                code: {requestError.code}
              </p>
            </div>
          )}

          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Salvar
          </button>
        </form>
      )}
    </Dialog>
  );
}
