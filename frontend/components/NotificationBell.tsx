'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  fetchNotifications, 
  fetchUnreadNotificationCount, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getStoredAuth,
  type Notification
} from '@/lib/api';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUnreadCount();
    
    // Close dropdown on click outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadUnreadCount() {
    const { token } = getStoredAuth();
    if (!token) return;

    try {
      const res = await fetchUnreadNotificationCount();
      setUnreadCount(res.count ?? 0);
    } catch {
      // Gracefully fall back if offline or unauthenticated without throwing dev console overlay
      setUnreadCount(0);
    }
  }

  async function toggleDropdown() {
    if (!isOpen) {
      setIsOpen(true);
      const { token } = getStoredAuth();
      if (!token) {
        setNotifications([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchNotifications(1);
        setNotifications(res.notifications?.data ?? []);
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    } else {
      setIsOpen(false);
    }
  }

  async function handleMarkAsRead(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Gracefully ignore mark-as-read failure
    }
  }

  async function handleMarkAllAsRead(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // Gracefully ignore mark-all-as-read failure
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        type="button"
        onClick={toggleDropdown}
        className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden z-50 flex flex-col max-h-[400px]">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/60 dark:bg-slate-800/40">
            <h3 className="font-bold text-[14px] text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                type="button"
                onClick={handleMarkAllAsRead} 
                className="text-[12px] text-orange-500 hover:text-orange-600 font-semibold cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-[13px]">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-[13px]">No notifications yet.</div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${!notif.read_at ? 'bg-orange-50/40 dark:bg-orange-950/20' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h4 className={`text-[13px] ${!notif.read_at ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'}`}>
                        {notif.title}
                      </h4>
                      {!notif.read_at && (
                        <button 
                          type="button"
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5 cursor-pointer"
                          title="Mark as read"
                        />
                      )}
                    </div>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 block font-medium">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 text-center bg-slate-50/60 dark:bg-slate-800/40">
            <Link 
              href="/notifications" 
              onClick={() => setIsOpen(false)} 
              className="text-[13px] font-bold text-orange-500 hover:text-orange-600 transition-colors"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
