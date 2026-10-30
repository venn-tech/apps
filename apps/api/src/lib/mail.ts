import nodemailer from "nodemailer";
import { env } from "../env.js";

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;

export async function sendMail(to: string, subject: string, text: string) {
  if (!transport) {
    console.log(`[mail:console] para=${to} assunto="${subject}"\n${text}`);
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
}
