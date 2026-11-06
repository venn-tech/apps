import { Resend } from "resend";
import { env } from "../env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendMail(to: string, subject: string, text: string) {
  if (!resend) {
    console.log(`[mail:console] para=${to} assunto="${subject}"\n${text}`);
    return;
  }
  const { error } = await resend.emails.send({ from: env.MAIL_FROM, to, subject, text });
  if (error) throw new Error(`Falha ao enviar e-mail (Resend): ${error.message}`);
}
