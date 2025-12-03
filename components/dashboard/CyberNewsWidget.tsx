import React, { useEffect, useState } from 'react';
import { integrationService, CyberNewsItem } from '../../services/integrationService';
import { Shield, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

export const CyberNewsWidget: React.FC = () => {
    const { t, language } = useStore();
    const [news, setNews] = useState<CyberNewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const [certItems, cnilItems] = await Promise.all([
                integrationService.getCyberNews(),
                integrationService.getCnilNews()
            ]);

            const allNews = [...certItems, ...cnilItems].sort((a, b) =>
                new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
            );

            setNews(allNews);
        } catch (error) {
            ErrorLogger.error(error, "CyberNewsWidget.fetchNews");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
    }, []);

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'dd MMM yyyy', { locale: language === 'fr' ? fr : enUS });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="glass-panel p-6 rounded-[2.5rem] shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-indigo-500" />
                    {t('dashboard.cyberNewsTitle')}
                </h3>
                <button
                    onClick={fetchNews}
                    className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 transition-colors ${loading ? 'animate-spin' : ''}`}
                    title={t('dashboard.refresh')}
                >
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                {loading && news.length === 0 ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse">
                                <div className="h-4 bg-slate-200 dark:bg-white/5 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-slate-100 dark:bg-white/5 rounded w-1/2"></div>
                            </div>
                        ))}
                    </div>
                ) : news.length > 0 ? (
                    news.map((item, index) => (
                        <a
                            key={index}
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/20 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all group"
                        >
                            <div className="flex justify-between items-start">
                                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 mb-2">
                                    {item.title}
                                </h4>
                                <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                                <span className="bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {item.source}
                                </span>
                                <span>
                                    {formatDate(item.pubDate)}
                                </span>
                            </div>
                        </a>
                    ))
                ) : (
                    <div className="text-center text-slate-500 py-8 text-sm">
                        {t('dashboard.noNews')}
                    </div>
                )}
            </div>
        </div>
    );
};
