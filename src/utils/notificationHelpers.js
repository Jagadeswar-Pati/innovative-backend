import Notification from '../models/Notification.model.js';

export const createNotification = async ({
  type = 'system',
  title,
  message,
  entityType,
  entityId,
}) => {
  if (!title || !message) return null;
  return Notification.create({
    type,
    title,
    message,
    entityType,
    entityId,
  });
};
