import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  FileText,
  MessageSquare,
  Send,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import { AppNotification, UserAccount } from '../types';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/notificationService';

export interface NotificationBellProps {
  currentUser: UserAccount | null;
  onSelectProposal: (proposalId: string) => void;
  className?: string;
}

export function NotificationBell({
  currentUser,
  onSelectProposal,
  className = '',
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userIdentifier = currentUser?.email || currentUser?.uid || 'guest';

  // Real-time subscription to notifications
  useEffect(() => {
    const unsubscribe = subscribeToNotifications(currentUser, (updated) => {
      setNotifications(updated);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Check if an item is unread by the current user
  const isUnread = (notif: AppNotification) => {
    if (!userIdentifier || userIdentifier === 'guest') return true;
    return !notif.readBy || !notif.readBy.includes(userIdentifier);
  };

  const unreadCount = notifications.filter(isUnread).length;

  const filteredNotifications =
    activeTab === 'unread' ? notifications.filter(isUnread) : notifications;

  const handleMarkAllAsRead = async () => {
    if (!userIdentifier) return;
    await markAllNotificationsAsRead(notifications, userIdentifier);
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (isUnread(notif)) {
      await markNotificationAsRead(notif.id, userIdentifier);
    }
    setIsOpen(false);
    if (notif.proposalId) {
      onSelectProposal(notif.proposalId);
    }
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    await deleteNotification(notifId, userIdentifier);
  };

  // Helper for relative time formatting
  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = new Date();
      const past = new Date(dateStr);
      const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);

      if (diffSec < 45) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      const days = Math.floor(diffSec / 86400);
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  // Icon and badge styling based on notification type
  const renderTypeDetails = (type: string) => {
    switch (type) {
      case 'proposal_submitted':
        return {
          icon: <Send className="w-4 h-4 text-blue-600" />,
          bgColor: 'bg-blue-50 border-blue-200',
          badgeText: 'Submitted',
          badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'proposal_approved':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          bgColor: 'bg-emerald-50 border-emerald-200',
          badgeText: 'Union Voted',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'liaison_voted':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-indigo-600" />,
          bgColor: 'bg-indigo-50 border-indigo-200',
          badgeText: 'Liaison Vote',
          badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        };
      case 'proposal_authorized':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-700" />,
          bgColor: 'bg-emerald-50 border-emerald-300',
          badgeText: 'OV27 Auth',
          badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        };
      case 'note_added':
        return {
          icon: <MessageSquare className="w-4 h-4 text-amber-600" />,
          bgColor: 'bg-amber-50 border-amber-200',
          badgeText: 'Review Note',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      default:
        return {
          icon: <FileText className="w-4 h-4 text-indigo-600" />,
          bgColor: 'bg-indigo-50 border-indigo-200',
          badgeText: 'Update',
          badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        };
    }
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition active:scale-95 cursor-pointer flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-[#1c398e]/20"
        title="Notifications"
        aria-label={`Notifications: ${unreadCount} unread`}
      >
        <Bell className="w-4 h-4 text-slate-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white animate-in zoom-in-50 duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-[320px] sm:w-[380px] max-w-[calc(100vw-24px)] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-slate-200/90 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col"
          style={{ maxHeight: 'min(440px, calc(100vh - 90px))' }}
        >
          {/* Header */}
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#1c398e]/10 text-[#1c398e]">
                <Bell className="w-3.5 h-3.5" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-none">Notifications</h3>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                  {unreadCount === 0
                    ? 'All caught up'
                    : `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-[#1c398e] hover:bg-blue-50 transition cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Mark read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center px-3.5 pt-1.5 sm:px-4 sm:pt-2 border-b border-slate-100 bg-white gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`pb-1.5 sm:pb-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                activeTab === 'all'
                  ? 'border-[#1c398e] text-[#1c398e]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`pb-1.5 sm:pb-2 text-xs font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'unread'
                  ? 'border-[#1c398e] text-[#1c398e]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[280px] sm:max-h-[320px] divide-y divide-slate-100 flex-1 min-h-0">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-2">
                  <CheckCheck className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[220px]">
                  {activeTab === 'unread'
                    ? 'You have reviewed all active proposal alerts.'
                    : 'Alerts for proposal submissions, approvals, and reviewer notes will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const unread = isUnread(notif);
                const typeInfo = renderTypeDetails(notif.type);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-2.5 sm:p-3 transition group cursor-pointer relative hover:bg-slate-50/90 flex gap-2.5 ${
                      unread ? 'bg-blue-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Left Icon */}
                    <div
                      className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center ${typeInfo.bgColor}`}
                    >
                      {typeInfo.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${typeInfo.badgeColor}`}
                        >
                          {typeInfo.badgeText}
                        </span>
                        {notif.union && (
                          <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[150px]">
                            {notif.union}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto font-medium">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>

                      <h4
                        className={`text-xs leading-snug line-clamp-2 ${
                          unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                        }`}
                      >
                        {notif.title}
                      </h4>

                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      {notif.createdBy?.name && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1.5 font-medium">
                          <span>By: {notif.createdBy.name}</span>
                          {notif.createdBy.role && (
                            <span className="capitalize">({notif.createdBy.role.replace('_', ' ')})</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Unread Indicator & Delete Button */}
                    <div className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3 flex flex-col items-center gap-1.5">
                      {unread && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#1c398e]"
                          title="Unread notification"
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, notif.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition rounded-md hover:bg-slate-100 cursor-pointer"
                        title="Dismiss notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-slate-50 border-t border-slate-100 text-center shrink-0">
            <span className="text-[10px] text-slate-500 font-medium">
              Review Hub Notification
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
