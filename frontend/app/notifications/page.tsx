'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  fetchNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  type Notification
} from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadNotifications(1);
  }, []);

  async function loadNotifications(p: number) {
    setLoading(true);
    try {
      const res = await fetchNotifications(p);
      if (p === 1) {
        setNotifications(res.notifications.data);
      } else {
        setNotifications(prev => [...prev, ...res.notifications.data]);
      }
      setHasMore(res.notifications.current_page < res.notifications.last_page);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsRead(id: string) {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
      {/* Top Header / Back Navigation */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#3525cd] transition-colors">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>{t('common.back')}</span>
        </Link>
        <Link href="/" className="flex items-center gap-2 group">
          <span className="material-symbols-outlined text-[#3525cd] text-[24px]">confirmation_number</span>
          <span className="text-[18px] font-extrabold text-[#131b2e]">TiketHub</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('notifications.title')}</h1>
        <div className="flex items-center gap-3">
          <LanguageSwitcher variant="pill" />
          {notifications.some(n => !n.read_at) && (
            <button 
              onClick={handleMarkAllAsRead}
              className="text-xs sm:text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors cursor-pointer"
            >
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && page === 1 ? (
          <div className="p-12 text-center text-gray-500">{t('common.loading')}</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="mb-2">{t('notifications.noNotifications')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map(notif => (
              <div 
                key={notif.id} 
                className={`p-4 sm:p-6 transition-colors flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 ${!notif.read_at ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}
              >
                <div className="flex-1 pr-0 sm:pr-6">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`text-base ${!notif.read_at ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                      {notif.title}
                    </h3>
                    {!notif.read_at && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {t('notifications.new')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{notif.message}</p>
                  <span className="text-xs text-gray-400 font-medium">
                    {new Date(notif.created_at).toLocaleString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                
                {!notif.read_at && (
                  <button 
                    onClick={() => handleMarkAsRead(notif.id)}
                    className="flex-shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800 bg-white border border-blue-100 px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
                  >
                    {t('notifications.markRead')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        
        {hasMore && (
          <div className="p-6 text-center border-t border-gray-100">
            <button 
              onClick={() => loadNotifications(page + 1)}
              disabled={loading}
              className="px-6 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? t('common.loading') : t('notifications.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
