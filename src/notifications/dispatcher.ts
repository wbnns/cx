import type { NotificationChannel, NotificationEvent, AgentFrontmatter, CxConfig } from '../types/index.js';
import { sendTelegram } from './telegram.js';

export interface NotificationPayload {
  event: NotificationEvent;
  agent: AgentFrontmatter;
  message: string;
  details?: Record<string, unknown>;
}

export async function dispatch(
  config: CxConfig,
  agent: AgentFrontmatter,
  payload: NotificationPayload,
): Promise<void> {
  const notifications = agent.notifications ?? [];
  if (notifications.length === 0) return;

  const promises = notifications.map(async (notification) => {
    // Check if this notification config cares about this event
    const events = notification.events ?? ['completion', 'failure', 'trigger', 'budget_warning'];
    if (!events.includes(payload.event)) return;

    try {
      await sendToChannel(config, notification.channel, payload);
    } catch (err) {
      // Never block on notification failure
      console.error(`Notification to ${notification.channel} failed:`, err);
    }
  });

  await Promise.allSettled(promises);
}

async function sendToChannel(
  config: CxConfig,
  channel: NotificationChannel,
  payload: NotificationPayload,
): Promise<void> {
  switch (channel) {
    case 'telegram':
      if (!config.notifications?.telegram) {
        throw new Error('Telegram not configured');
      }
      await sendTelegram(
        config.notifications.telegram.bot_token,
        config.notifications.telegram.default_chat_id,
        formatMessage(payload),
      );
      break;
  }
}

function formatMessage(payload: NotificationPayload): string {
  const emoji = {
    completion: '✅',
    failure: '❌',
    trigger: '🔔',
    budget_warning: '⚠️',
  }[payload.event];

  return `${emoji} *cx: ${payload.agent.name}*\n\n${payload.message}`;
}
