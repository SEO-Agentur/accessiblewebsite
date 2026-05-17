import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { QuoteRequestInput } from '@accessiblewebsite/shared';
import { quoteRequests } from '@accessiblewebsite/db';
import { db } from '../../../lib/db';
import { routePath } from '../../../i18n/routes';
import { env } from '../../../env';

export const prerender = false;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return (await request.json()) as Record<string, unknown>;
  const form = await request.formData();
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) out[k] = typeof v === 'string' ? v : v.name;
  return out;
}

function wantsJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

function targetHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const raw = await readBody(request);
  const parsed = QuoteRequestInput.safeParse(raw);
  const remediation = routePath('remediation', locals.locale);

  if (!parsed.success) {
    if (wantsJson(request)) {
      return new Response(
        JSON.stringify({ error: 'validation_failed', detail: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }
    return redirect(`${remediation}?error=invalid_input#quote-form`, 303);
  }

  const data = parsed.data;
  const host = targetHost(data.websiteUrl);

  await db().insert(quoteRequests).values({
    userId: locals.user?.id ?? null,
    email: data.email.toLowerCase(),
    fullName: data.fullName,
    companyName: data.companyName ?? null,
    scannedDomain: host,
    platformCms: data.platformCms,
    estimatedPages: data.estimatedPages,
    urgency: data.urgency,
    message: data.message ?? null,
    language: data.language,
    sourceUrl: request.headers.get('referer') ?? null,
    status: 'new',
  });

  // Best-effort email. If Resend isn't configured we still complete the
  // submission so the lead lands in the DB; an operator will see it via SQL
  // or the (future) admin panel.
  const cfg = env();
  if (cfg.RESEND_API_KEY) {
    const isDE = data.language === 'de';
    const fromAddress = isDE ? cfg.RESEND_FROM_DE : cfg.RESEND_FROM_EN;
    const resend = new Resend(cfg.RESEND_API_KEY);

    // 1) Confirmation to the requester
    try {
      await resend.emails.send({
        from: fromAddress,
        to: data.email,
        subject: isDE
          ? 'Wir haben Ihre Anfrage erhalten'
          : 'We received your request',
        text: isDE
          ? `Hallo ${data.fullName},\n\nVielen Dank für Ihre Anfrage zu ${host}. Eine Fachkraft unseres Teams meldet sich innerhalb von 48 Stunden mit einem Festpreis-Angebot und einem Zeitplan.\n\nFalls etwas dringend ist, antworten Sie einfach auf diese E-Mail.\n\n— ${fromAddress}`
          : `Hi ${data.fullName},\n\nThanks for your request about ${host}. A specialist from our team will reply within 48 hours with a fixed-price quote and a timeline.\n\nIf anything is urgent, just reply to this email.\n\n— ${fromAddress}`,
      });
    } catch (err) {
      console.warn('[quote-request] confirmation email failed:', err);
    }

    // 2) Internal notification
    try {
      await resend.emails.send({
        from: fromAddress,
        to: fromAddress,
        replyTo: data.email,
        subject: `New quote request: ${host} (${data.urgency})`,
        text:
          `Name: ${data.fullName}\n` +
          `Email: ${data.email}\n` +
          `Company: ${data.companyName ?? '—'}\n` +
          `Website: ${data.websiteUrl}\n` +
          `Platform: ${data.platformCms}\n` +
          `Pages: ${data.estimatedPages}\n` +
          `Urgency: ${data.urgency}\n` +
          `Language: ${data.language}\n` +
          `Message:\n${data.message ?? '(none)'}\n`,
      });
    } catch (err) {
      console.warn('[quote-request] internal notification failed:', err);
    }
  }

  if (wantsJson(request)) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }
  return redirect(routePath('quoteConfirmation', locals.locale), 303);
};
