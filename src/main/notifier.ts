import { Notification } from 'electron';
import type { NotificationLogEntry, Settings } from '../shared/types';
import { logger } from './logger';

export class Notifier {
  show(notification: NotificationLogEntry, settings: Settings) {
    if (!Notification.isSupported()) {
      logger.warn('Desktop notifications are not supported on this platform');
      return;
    }

    if (!settings.notificationsEnabled) {
      logger.info('Notifications disabled in settings, skipping desktop notification');
      return;
    }

    try {
      const notificationInstance = new Notification({
        title: notification.title,
        body: notification.body,
        silent: !settings.soundEnabled,
      });
      notificationInstance.show();
    } catch (error) {
      logger.error('Failed to show notification', error);
    }
  }
}
