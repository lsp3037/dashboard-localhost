'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';
import {
  ArrowLeftIcon,
  CheckIcon,
  CloseIcon,
  FolderIcon,
  HardDriveIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
} from '@/components/ui/icons';
import { ApiError, getJson } from '@/lib/client/api';

export interface DirectoryItem {
  name: string;
  path: string;
}

export interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  directories: DirectoryItem[];
  drives?: string[];
}

export interface DirectoryPickerProps {
  selectedRoots: string[];
  onRootsChange: (roots: string[]) => void;
  initialPath?: string;
}

export function DirectoryPicker({ selectedRoots, onRootsChange, initialPath }: DirectoryPickerProps) {
  const [currentPath, setCurrentPath] = useState<string>(initialPath ?? '');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = path ? `/api/system/directories?path=${encodeURIComponent(path)}` : '/api/system/directories';
      const data = await getJson<DirectoryListing>(url);
      setListing(data);
      setCurrentPath(data.currentPath);
      setFilterQuery('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.friendlyMessage);
      } else {
        setError('Não foi possível listar as pastas deste diretório.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError(null);
      try {
        const url = initialPath ? `/api/system/directories?path=${encodeURIComponent(initialPath)}` : '/api/system/directories';
        const data = await getJson<DirectoryListing>(url);
        if (!active) return;
        setListing(data);
        setCurrentPath(data.currentPath);
        setFilterQuery('');
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError) {
          setError(err.friendlyMessage);
        } else {
          setError('Não foi possível listar as pastas deste diretório.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [initialPath]);

  const addRoot = (pathToAdd: string) => {
    const trimmed = pathToAdd.trim();
    if (!trimmed) return;
    const normalized = trimmed.replace(/[/\\]+$/, '');
    const exists = selectedRoots.some(
      (r) => r.toLowerCase().replace(/[/\\]+$/, '') === normalized.toLowerCase(),
    );
    if (!exists) {
      onRootsChange([...selectedRoots, trimmed]);
    }
  };

  const removeRoot = (pathToRemove: string) => {
    onRootsChange(selectedRoots.filter((r) => r !== pathToRemove));
  };

  const handleManualAdd = (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    const trimmed = manualInput.trim();
    if (!trimmed) {
      setManualError('Digite ou cole o caminho absoluto de uma pasta.');
      return;
    }
    setManualError(null);
    addRoot(trimmed);
    setManualInput('');
  };

  const isSelected = (targetPath: string): boolean => {
    const normalized = targetPath.toLowerCase().replace(/[/\\]+$/, '');
    return selectedRoots.some((r) => r.toLowerCase().replace(/[/\\]+$/, '') === normalized);
  };

  const filteredDirs = useMemo(() => {
    if (!listing?.directories) return [];
    const query = filterQuery.trim().toLowerCase();
    if (!query) return listing.directories;
    return listing.directories.filter((item) => item.name.toLowerCase().includes(query));
  }, [listing, filterQuery]);

  const pathSegments = useMemo(() => {
    if (!listing?.currentPath) return [];
    const raw = listing.currentPath;
    const isWindows = /^[a-zA-Z]:\\/.test(raw) || raw.includes('\\');
    const parts = raw.split(/[/\\]+/).filter(Boolean);

    const segments: Array<{ label: string; fullPath: string }> = [];
    let acc: string;

    if (isWindows && /^[a-zA-Z]:/.test(parts[0] ?? '')) {
      const driveLetter = parts[0]!;
      acc = `${driveLetter}\\`;
      segments.push({ label: `${driveLetter}\\`, fullPath: acc });
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        acc += (acc.endsWith('\\') ? '' : '\\') + part;
        segments.push({ label: part, fullPath: acc });
      }
    } else {
      acc = '';
      for (const part of parts) {
        acc += '/' + part;
        segments.push({ label: part, fullPath: acc });
      }
    }

    return segments;
  }, [listing]);

  const currentIsSelected = listing?.currentPath ? isSelected(listing.currentPath) : false;

  return (
    <div className="flex flex-col gap-3 text-[12px]">
      {/* 1. Drive Selector (se disponível no Windows) */}
      {listing?.drives && listing.drives.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-hub-border pb-2.5">
          <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-hub-text-muted">
            <HardDriveIcon width={13} height={13} />
            Unidades:
          </span>
          {listing.drives.map((drive) => {
            const isActive = listing.currentPath.toLowerCase().startsWith(drive.toLowerCase());
            return (
              <button
                key={drive}
                type="button"
                onClick={() => void loadDirectory(drive)}
                className={[
                  'inline-flex h-6 items-center gap-1 rounded-sm border px-2 font-mono text-[11px] font-medium transition-colors',
                  isActive
                    ? 'border-hub-accent bg-hub-accent/10 text-hub-accent'
                    : 'border-hub-border bg-hub-surface-raised text-hub-text hover:border-hub-accent hover:text-hub-accent',
                ].join(' ')}
              >
                {drive}
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Barra de Navegação & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-hub-border bg-hub-bg px-2.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto text-[11px]">
          {listing?.parentPath ? (
            <button
              type="button"
              onClick={() => void loadDirectory(listing.parentPath!)}
              title="Voltar ao diretório pai"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-hub-text-muted hover:bg-hub-surface-raised hover:text-hub-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hub-accent"
            >
              <ArrowLeftIcon width={13} height={13} />
            </button>
          ) : (
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-hub-text-muted/40">
              <FolderIcon width={13} height={13} />
            </span>
          )}

          {/* Breadcrumb segments */}
          <div className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-[11px] text-hub-text">
            {pathSegments.map((seg, idx) => {
              const isLast = idx === pathSegments.length - 1;
              return (
                <span key={seg.fullPath} className="inline-flex items-center gap-1">
                  {idx > 0 && <span className="text-hub-text-muted/50">/</span>}
                  <button
                    type="button"
                    onClick={() => void loadDirectory(seg.fullPath)}
                    className={[
                      'rounded-sm px-1 py-0.5 transition-colors',
                      isLast
                        ? 'font-semibold text-hub-text bg-hub-surface-raised'
                        : 'text-hub-text-muted hover:bg-hub-surface hover:text-hub-text',
                    ].join(' ')}
                  >
                    {seg.label}
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        {/* Botão para adicionar a pasta aberta atual */}
        {listing?.currentPath && (
          <Button
            size="sm"
            variant={currentIsSelected ? 'secondary' : 'primary'}
            disabled={currentIsSelected}
            onClick={() => addRoot(listing.currentPath)}
            className="shrink-0 text-[11px]"
          >
            {currentIsSelected ? (
              <>
                <CheckIcon width={12} height={12} className="text-status-running" />
                Pasta atual selecionada
              </>
            ) : (
              <>
                <PlusIcon width={12} height={12} />
                Selecionar pasta atual
              </>
            )}
          </Button>
        )}
      </div>

      {/* 3. Subpastas / Lista de Diretórios */}
      <div className="flex flex-col rounded-sm border border-hub-border bg-hub-surface">
        <div className="flex items-center justify-between gap-2 border-b border-hub-border px-3 py-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-hub-text-muted">
            Subpastas ({filteredDirs.length})
          </span>
          <div className="relative w-44 sm:w-52">
            <SearchIcon
              width={12}
              height={12}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-hub-text-muted"
            />
            <input
              type="text"
              placeholder="Filtrar subpastas..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="h-6 w-full rounded-sm border border-hub-border bg-hub-bg pl-6 pr-2 font-mono text-[11px] text-hub-text placeholder:font-sans placeholder:text-hub-text-muted/60 focus-visible:border-hub-accent focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="max-h-52 min-h-32 overflow-y-auto p-1">
          {loading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-hub-text-muted">
              <SpinnerIcon width={16} height={16} />
              <span className="text-[12px]">Carregando pastas...</span>
            </div>
          ) : error ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 p-3 text-center text-status-error">
              <p className="text-[12px]">{error}</p>
              <Button size="sm" variant="secondary" onClick={() => void loadDirectory(currentPath)}>
                Tentar novamente
              </Button>
            </div>
          ) : filteredDirs.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-center text-hub-text-muted">
              <p className="text-[11px]">
                {filterQuery.trim()
                  ? `Nenhuma pasta encontrada com "${filterQuery}".`
                  : 'Nenhuma subpasta encontrada neste diretório.'}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filteredDirs.map((item) => {
                const itemSelected = isSelected(item.path);
                return (
                  <li
                    key={item.path}
                    className="group flex items-center justify-between gap-2 rounded-sm px-2 py-1 transition-colors hover:bg-hub-surface-raised"
                  >
                    <button
                      type="button"
                      onClick={() => void loadDirectory(item.path)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hub-accent"
                    >
                      <FolderIcon
                        width={14}
                        height={14}
                        className="shrink-0 text-hub-accent group-hover:text-hub-accent-strong"
                      />
                      <span className="truncate font-mono text-[11px] text-hub-text group-hover:underline">
                        {item.name}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => (itemSelected ? removeRoot(item.path) : addRoot(item.path))}
                      title={itemSelected ? 'Remover da seleção' : 'Selecionar como raiz de projetos'}
                      className={[
                        'inline-flex h-6 items-center gap-1 rounded-sm border px-2 text-[10px] font-medium transition-colors',
                        itemSelected
                          ? 'border-status-running/40 bg-status-running/10 text-status-running hover:border-status-error/40 hover:bg-status-error/10 hover:text-status-error'
                          : 'border-hub-border bg-hub-bg text-hub-text-muted opacity-80 group-hover:opacity-100 hover:border-hub-accent hover:text-hub-accent',
                      ].join(' ')}
                    >
                      {itemSelected ? (
                        <>
                          <CheckIcon width={11} height={11} />
                          Selecionada
                        </>
                      ) : (
                        <>
                          <PlusIcon width={11} height={11} />
                          Adicionar
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* 4. Campo alternativo para digitação/colagem de caminho */}
      <form onSubmit={handleManualAdd} className="flex flex-col gap-1">
        <label htmlFor="manual-directory-path" className="text-[11px] font-medium uppercase tracking-wider text-hub-text-muted">
          Ou cole/digite um caminho absoluto:
        </label>
        <div className="flex gap-2">
          <input
            id="manual-directory-path"
            type="text"
            value={manualInput}
            onChange={(e) => {
              setManualInput(e.target.value);
              if (manualError) setManualError(null);
            }}
            placeholder="Ex: C:\MeusProjetos ou /Users/nome/projetos"
            className={`${inputClass} flex-1`}
          />
          <Button type="submit" variant="secondary" size="md">
            <PlusIcon width={12} height={12} />
            Adicionar pasta
          </Button>
        </div>
        {manualError && <p className="text-[11px] text-status-error">{manualError}</p>}
      </form>

      {/* 5. Lista de Pastas Selecionadas */}
      <div className="rounded-sm border border-hub-border bg-hub-surface p-2.5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-hub-text-muted">
            Pastas Raízes Selecionadas ({selectedRoots.length})
          </span>
          {selectedRoots.length === 0 && (
            <span className="text-[11px] text-hub-accent">Selecione pelo menos uma pasta</span>
          )}
        </div>

        {selectedRoots.length === 0 ? (
          <p className="rounded-sm border border-dashed border-hub-border p-3 text-center text-[11px] text-hub-text-muted">
            Nenhuma pasta selecionada ainda. Navegue acima e clique em &quot;Selecionar pasta atual&quot; ou no botão &quot;Adicionar&quot; de uma subpasta.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {selectedRoots.map((root) => (
              <li
                key={root}
                className="flex items-center justify-between gap-2 rounded-sm border border-hub-border-strong bg-hub-surface-raised px-2.5 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FolderIcon width={13} height={13} className="shrink-0 text-hub-accent" />
                  <span className="truncate font-mono text-[11px] text-hub-text" title={root}>
                    {root}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeRoot(root)}
                  title="Remover pasta"
                  aria-label={`Remover ${root}`}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-hub-text-muted hover:text-status-error focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hub-accent"
                >
                  <CloseIcon width={12} height={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
