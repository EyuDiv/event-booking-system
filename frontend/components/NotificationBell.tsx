'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  fetchNotifications, 
  fetchUnreadNotificationCount, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadUnreadCount() {
    try {
      const res = await fetchUnreadNotificationCount();
      setUnreadCount(res.count);
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleDropdown() {
    if (!isOpen) {
      setIsOpen(true);
      setLoading(true);
      try {
        const res = await fetchNotifications(1);
        setNotifications(res.notifications.data);
      } catch (e) {
        console.error(e);
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
    } catch (e) {
      console.error(e);
    }
  }

  async function handleMarkAllAsRead(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleDropdown}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-[24px] text-gray-700">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 flex flex-col max-h-[400px]">
          <div className="p-3 border-b flex justify-between items-center bg-gray-50">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No notifications yet.</div>
            ) : (
              <div className="flex flex-col">
                {notifications.map(notif => (
                  <div 
                    key={notif.id} 
                    className={`p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${!notif.read_at ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm ${!notif.read_at ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.title}
                      </h4>
                      {!notif.read_at && (
                        <button 
                          onClick={(e) => handleMarkAsRead(notif.id, e)}
                          className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 ml-2 mt-1"
                          title="Mark as read"
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{notif.message}</p>
                    <span className="text-[10px] text-gray-400 mt-2 block">
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t text-center bg-gray-50">
            <Link href="/notifications" onClick={() => setIsOpen(false)} className="text-sm font-medium text-blue-600 hover:text-blue-800">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
