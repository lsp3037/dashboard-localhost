'use client';

import { ProjectCard } from '@/components/project-card';
import { WorkspaceGroup } from '@/components/workspace-group';
import type { ProjectView } from '@/lib/shared/view-model';

export interface ProjectTree {
  standalone: ProjectView[];
  workspaces: { parent: ProjectView; children: ProjectView[] }[];
}

/** Agrupa filhos sob o pai (`parentId`) sem duplicar o card do workspace. */
export function buildProjectTree(projects: readonly ProjectView[]): ProjectTree {
  const known = new Set(projects.map((project) => project.id));
  const childrenByParent = new Map<string, ProjectView[]>();
  const roots: ProjectView[] = [];

  for (const project of projects) {
    if (project.parentId !== null && known.has(project.parentId)) {
      const siblings = childrenByParent.get(project.parentId);
      if (siblings === undefined) {
        childrenByParent.set(project.parentId, [project]);
      } else {
        siblings.push(project);
      }
      continue;
    }

    roots.push(project);
  }

  const standalone: ProjectView[] = [];
  const workspaces: ProjectTree['workspaces'] = [];

  for (const root of roots) {
    const children = childrenByParent.get(root.id);
    if (children === undefined || children.length === 0) {
      standalone.push(root);
      continue;
    }
    workspaces.push({ parent: root, children });
  }

  return { standalone, workspaces };
}

interface ProjectGridProps {
  projects: readonly ProjectView[];
  onEdit: (project: ProjectView) => void;
  onToggleHidden: (project: ProjectView) => void;
  onRemove: (project: ProjectView) => void;
}

/** Grid 1 / 2 / 3 colunas (§5.5) com workspaces ocupando a linha inteira. */
export function ProjectGrid({ projects, onEdit, onToggleHidden, onRemove }: ProjectGridProps) {
  const { standalone, workspaces } = buildProjectTree(projects);

  return (
    <div className="flex flex-col gap-3">
      {standalone.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {standalone.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              onEdit={onEdit}
              onToggleHidden={onToggleHidden}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {workspaces.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.16em] text-hub-text-muted">
            Workspaces monitorados
          </h2>
          <div className="flex flex-col gap-3">
            {workspaces.map((group) => (
              <WorkspaceGroup
                key={group.parent.id}
                parent={group.parent}
                items={group.children}
                onEdit={onEdit}
                onToggleHidden={onToggleHidden}
                onRemove={onRemove}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
