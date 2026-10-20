'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, fieldAria } from '@/components/ui/field';
import { ApiError, postJson } from '@/lib/client/api';
import { pushToast } from '@/lib/client/hub-events';

interface AddProjectDialogProps {
  open: boolean;
  onClose: () => void;
  /** Raízes monitoradas, só para o texto de ajuda. */
  roots: readonly string[];
}

interface CreatedProject {
  project: { id: string; name: string };
}

export function AddProjectDialog({ open, onClose, roots }: AddProjectDialogProps) {
  const router = useRouter();
  const [path, setPath] = useState('');
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<{ code: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  // O diálogo continua montado entre aberturas; limpar no fechamento substitui o
  // efeito de reset (proibido por react-hooks/set-state-in-effect).
  const close = () => {
    setPath('');
    setName('');
    setFieldError(null);
    setRequestError(null);
    setPending(false);
    onClose();
  };

  const submit = async () => {
    const trimmed = path.trim();

    if (trimmed.length === 0) {
      setFieldError('Informe o caminho de uma pasta.');
      return;
    }

    setFieldError(null);
    setRequestError(null);
    setPending(true);

    try {
      const created = await postJson<CreatedProject>('/api/projects', {
        path: trimmed,
        ...(name.trim().length > 0 ? { name: name.trim() } : {}),
      });

      pushToast({
        tone: 'success',
        title: 'Projeto adicionado',
        description: `${created.project.name} entrou no inventário.`,
      });
      close();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setRequestError({ code: error.code, message: error.friendlyMessage });
      } else {
        setRequestError({ code: 'UNKNOWN', message: 'Falha inesperada ao adicionar o projeto.' });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Adicionar projeto"
      description="Cadastro manual por caminho. A pasta precisa conter package.json ou .git."
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={pending} aria-busy={pending}>
            {pending ? 'Adicionando…' : 'Adicionar'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field
          id="add-path"
          label="Caminho da pasta"
          required
          hint={roots.length > 0 ? `Raízes monitoradas: ${roots.join(' · ')}` : undefined}
          error={fieldError}
        >
          <Input
            id="add-path"
            name="path"
            autoFocus
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder={roots[0] ? `${roots[0]}\\meu-app` : String.raw`C:\Projetos\meu-app`}
            spellCheck={false}
            autoComplete="off"
            {...fieldAria('add-path', roots.length > 0 ? `Raízes monitoradas: ${roots.join(' · ')}` : undefined, fieldError)}
          />
        </Field>

        <Field id="add-name" label="Nome exibido" labelHint="opcional" hint="Sem nome, usamos o nome da pasta.">
          <Input
            id="add-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="meu-app"
            autoComplete="off"
          />
        </Field>

        {requestError && (
          <div role="alert" className="border border-status-error/50 bg-status-error/5 px-2.5 py-2">
            <p className="text-[12px] leading-4 text-status-error">{requestError.message}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-hub-text-muted">
              code: {requestError.code}
            </p>
          </div>
        )}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Adicionar
        </button>
      </form>
    </Dialog>
  );
}
