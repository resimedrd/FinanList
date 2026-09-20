import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Modal } from './Modal';
import { DynamicIcon } from './DynamicIcon';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    requestNotificationPermission
  } = useApp();

  const [filterUnreadOnly, setFilterUnreadOnly] = useState<boolean>(false);
  const [devicePermission, setDevicePermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    if (res) {
      setDevicePermission(res);
      if (res === 'granted') {
        try {
          new Notification('FinanList Alertas', {
            body: '¡Notificaciones en el dispositivo activadas con éxito!',
            icon: '/icons/icon-192x192.png'
          });
        } catch (e) {
          console.warn(e);
        }
      }
    }
  };

  const filteredNotifs = filterUnreadOnly
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

      if (diffMinutes < 1) return 'Hace un momento';
      if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DynamicIcon name="Bell" size={18} color="var(--color-primary)" />
          <span style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)' }}>
            Notificaciones y Alertas
          </span>
          {unreadCount > 0 && (
            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              backgroundColor: 'var(--color-danger)',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '2px 7px'
            }}>
              {unreadCount}
            </span>
          )}
        </div>
      }
      maxWidth="440px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Device Push Notification Integration Banner */}
        {devicePermission !== 'unsupported' && devicePermission !== 'granted' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: 'var(--color-primary-light)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DynamicIcon name="Smartphone" size={18} color="var(--color-primary)" />
              <div style={{ fontSize: '11px', lineHeight: 1.3 }}>
                <span style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>
                  Alertas en tu teléfono
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Recibe avisos de sobregiro y saldo en tu pantalla.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestPermission}
              className="btn btn-primary"
              style={{
                fontSize: '11px',
                padding: '6px 10px',
                fontWeight: '700',
                whiteSpace: 'nowrap'
              }}
            >
              Activar
            </button>
          </div>
        )}

        {devicePermission === 'granted' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: '#10b981',
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)'
          }}>
            <DynamicIcon name="CheckCircle2" size={14} color="#10b981" />
            <span>Notificaciones activas en el dispositivo</span>
          </div>
        )}

        {/* Action Controls & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setFilterUnreadOnly(false)}
              style={{
                fontSize: '11px',
                fontWeight: !filterUnreadOnly ? '700' : '500',
                backgroundColor: !filterUnreadOnly ? 'var(--bg-card)' : 'transparent',
                border: '1px solid',
                borderColor: !filterUnreadOnly ? 'var(--border-color)' : 'transparent',
                borderRadius: '8px',
                padding: '4px 10px',
                color: !filterUnreadOnly ? 'var(--color-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterUnreadOnly(true)}
              style={{
                fontSize: '11px',
                fontWeight: filterUnreadOnly ? '700' : '500',
                backgroundColor: filterUnreadOnly ? 'var(--bg-card)' : 'transparent',
                border: '1px solid',
                borderColor: filterUnreadOnly ? 'var(--border-color)' : 'transparent',
                borderRadius: '8px',
                padding: '4px 10px',
                color: filterUnreadOnly ? 'var(--color-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Sin leer ({unreadCount})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Leídas
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAllNotifications}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}>
              <DynamicIcon name="BellOff" size={20} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
              No tienes alertas pendientes
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
              {filterUnreadOnly
                ? 'Todas tus notificaciones han sido leídas.'
                : 'Te avisaremos cuando alguna tarjeta alcance un umbral de límite o saldo bajo.'
              }
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
            {filteredNotifs.map(notif => {
              const isDanger = notif.severity === 'danger';
              const isWarning = notif.severity === 'warning';

              const badgeColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#6366f1';
              const badgeBg = isDanger ? 'rgba(239, 68, 68, 0.12)' : isWarning ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.12)';

              return (
                <div
                  key={notif.id}
                  style={{
                    backgroundColor: notif.isRead ? 'var(--bg-card)' : 'var(--bg-phone)',
                    border: `1px solid ${notif.isRead ? 'var(--border-color)' : badgeColor}`,
                    borderLeft: `4px solid ${badgeColor}`,
                    borderRadius: '14px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: notif.isRead ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  {/* Top line: Icon, Title, and Timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        backgroundColor: badgeBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: badgeColor
                      }}>
                        <DynamicIcon
                          name={isDanger ? 'AlertTriangle' : isWarning ? 'AlertCircle' : 'Info'}
                          size={13}
                        />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {notif.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {formatTimestamp(notif.createdAt)}
                      </span>
                      {!notif.isRead && (
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: badgeColor
                        }} />
                      )}
                    </div>
                  </div>

                  {/* Message body */}
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                    {notif.message}
                  </p>

                  {/* Bottom Action buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(notif.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: 'var(--color-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <DynamicIcon name="Check" size={12} />
                        <span>Marcar leída</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteNotification(notif.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <DynamicIcon name="Trash2" size={11} />
                      <span>Descartar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default NotificationCenter;
