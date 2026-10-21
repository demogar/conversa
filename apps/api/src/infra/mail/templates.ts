import type { Locale } from '@conversa/shared';

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function layout(paragraphs: string[], action: { label: string; url: string }, footer: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join('');
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1d1b16;max-width:520px;margin:32px auto;padding:0 16px">
${body}
<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#1d1b16;color:#fff;padding:12px 18px;text-decoration:none;display:inline-block">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#5c574d">${escapeHtml(action.url)}</p>
<p style="margin:24px 0 0;font-size:13px;color:#5c574d">${escapeHtml(footer)}</p>
</body></html>`;
}

function build(paragraphs: string[], action: { label: string; url: string }, footer: string, subject: string): MailContent {
  return {
    subject,
    text: [...paragraphs, `${action.label}: ${action.url}`, footer].join('\n\n'),
    html: layout(paragraphs, action, footer),
  };
}

export function invitationMail(
  locale: Locale,
  params: { inviter: string; workspace: string; url: string },
): MailContent {
  if (locale === 'es') {
    return build(
      [`${params.inviter} te invitó a unirte a «${params.workspace}» en Conversa.`],
      { label: 'Aceptar invitación', url: params.url },
      'La invitación vence en 7 días. Si no la esperabas, ignora este correo.',
      `Invitación a ${params.workspace}`,
    );
  }
  return build(
    [`${params.inviter} invited you to join “${params.workspace}” on Conversa.`],
    { label: 'Accept invitation', url: params.url },
    'The invitation expires in 7 days. If you were not expecting it, ignore this email.',
    `Invitation to ${params.workspace}`,
  );
}

export function passwordResetMail(locale: Locale, params: { url: string }): MailContent {
  if (locale === 'es') {
    return build(
      ['Recibimos una solicitud para restablecer tu contraseña de Conversa.'],
      { label: 'Restablecer contraseña', url: params.url },
      'El enlace vence en 1 hora y solo funciona una vez. Si no lo pediste, ignora este correo.',
      'Restablece tu contraseña',
    );
  }
  return build(
    ['We received a request to reset your Conversa password.'],
    { label: 'Reset password', url: params.url },
    'The link expires in 1 hour and works once. If you did not ask for it, ignore this email.',
    'Reset your password',
  );
}
