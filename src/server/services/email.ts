import nodemailer, { type Transporter } from "nodemailer";
import { env, isConfigured } from "@/server/env";
import { log } from "@/server/log";

// Outbound email over SMTP (free with a Gmail app password). When SMTP isn't
// configured the message is dropped with a log line — never an error for the
// caller — so local dev and CI work without credentials.

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env().SMTP_HOST,
    port: env().SMTP_PORT,
    secure: env().SMTP_PORT === 465,
    auth: { user: env().SMTP_USER, pass: env().SMTP_PASS },
  });
  return transporter;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Test hook: every email "sent" while NODE_ENV=test lands here instead. */
export const sentInTests: Email[] = [];

export async function sendEmail(email: Email): Promise<{ sent: boolean }> {
  if (process.env.NODE_ENV === "test") {
    sentInTests.push(email);
    return { sent: true };
  }
  if (!isConfigured.smtp()) {
    log.warn("email skipped: SMTP not configured", { subject: email.subject });
    return { sent: false };
  }
  try {
    await getTransporter().sendMail({
      from: env().SMTP_FROM ?? env().SMTP_USER,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    return { sent: true };
  } catch (err) {
    log.error("email send failed", { err, subject: email.subject });
    return { sent: false };
  }
}

/** Escape user-controlled text before putting it in an HTML email. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
