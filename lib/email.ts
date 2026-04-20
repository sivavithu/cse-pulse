import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error("SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local");
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export interface AlertMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendAlertEmail({ to, subject, text, html }: AlertMail) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER!;
  return getTransporter().sendMail({ from, to, subject, text, html });
}
