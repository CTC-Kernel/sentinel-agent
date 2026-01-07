import React from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Project } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProjectTasksWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const ProjectTasksWidget: React.FC<ProjectTasksWidgetProps> = ({ navigate, t = (k) => k }) => {
    const { user } = useStore();
    const routerNavigate = useNavigate();

    const { data: projects, loading } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const projectStats = React.useMemo(() => {
        let overdueCount = 0;
        let activeCount = 0;
        let completedCount = 0;

        projects.forEach(p => {
            if (p.status === 'Terminé') {
                completedCount++;
            } else {
                activeCount++;
                if (p.dueDate && new Date(p.dueDate) < new Date()) {
                    overdueCount++;
                }
            }
        });

        // Get top 3 urgent projects (overdue or closest due date)
        const urgentProjects = projects
            .filter(p => p.status !== 'Terminé')
            .sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                return dateA - dateB;
            })
            .slice(0, 3);

        return { overdueCount, activeCount, completedCount, urgentProjects };
    }, [projects]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
                <p>{t('dashboard.noProjectsData')}</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 bg-card rounded-2xl border border-border shadow-sm">
            <h3 className="text-lg font-bold mb-4">{t('dashboard.projectStatus')}</h3>

            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-center">
                    <div className="text-xl font-bold text-slate-700 dark:text-slate-200">{projectStats.activeCount}</div>
                    <div className="text-xs text-muted-foreground">En cours</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg text-center">
                    <div className="text-xl font-bold text-emerald-600">{projectStats.completedCount}</div>
                    <div className="text-xs text-emerald-600/80">Terminés</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-lg text-center">
                    <div className="text-xl font-bold text-red-600">{projectStats.overdueCount}</div>
                    <div className="text-xs text-red-600/80">En retard</div>
                </div>
            </div>

            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Projets Prioritaires</h4>
            <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {projectStats.urgentProjects.map(project => {
                    const isOverdue = project.dueDate && new Date(project.dueDate) < new Date();
                    return (
                        <div
                            key={project.id}
                            className="group flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                            onClick={() => {
                                const path = `/projects?id=${project.id}`;
                                if (navigate) navigate(path);
                                else routerNavigate(path);
                            }}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate text-foreground group-hover:text-brand-500 transition-colors">{project.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {isOverdue && <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">En retard</span>}
                                    <span className="text-[10px] text-muted-foreground">
                                        {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'Sans date'}
                                    </span>
                                </div>
                            </div>
                            <div className="ml-2 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                                {project.progress}%
                            </div>
                        </div>
                    );
                })}
                {projectStats.urgentProjects.length === 0 && (
                    <div className="text-sm text-muted-foreground italic text-center py-4">Aucun projet urgent</div>
                )}
            </div>
        </div>
    );
};
