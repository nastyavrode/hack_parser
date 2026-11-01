import nodemailer from 'nodemailer';
import { siteConfig } from '@/shared/config/site';

export async function sendHackathonNotice({
  email,
  title,
  slug,
  unsubscribeToken,
}: {
  email: string;
  title: string;
  slug: string;
  unsubscribeToken: string;
}) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !MAIL_FROM) {
    throw new Error('SMTP_HOST, SMTP_PORT и MAIL_FROM должны быть настроены для отправки уведомлений');
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    ...(SMTP_USER && SMTP_PASSWORD ? { auth: { user: SMTP_USER, pass: SMTP_PASSWORD } } : {}),
  });
  const eventUrl = `${siteConfig.url}/hackathons/${encodeURIComponent(slug)}`;
  const unsubscribeUrl = `${siteConfig.url}/api/subscriptions/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  await transport.sendMail({
    from: MAIL_FROM,
    to: email,
    subject: `Новое мероприятие для тебя: ${title}`,
    text: `${title}\n\nПосмотреть: ${eventUrl}\n\nОтписаться: ${unsubscribeUrl}`,
    html: `<p>Появилось новое подходящее событие:</p><h1>${escapeHtml(title)}</h1><p><a href="${eventUrl}">Посмотреть мероприятие</a></p><p><a href="${unsubscribeUrl}">Отписаться от уведомлений</a></p>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}
