import nodemailer from "nodemailer"

type SendMailInput = {
  to: string
  subject: string
  html: string
  text?: string
}

function requiredEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export function createMailer() {
  const provider = process.env.MAIL_PROVIDER || "gmail"

  if (provider !== "gmail") {
    throw new Error(`Unsupported MAIL_PROVIDER: ${provider}`)
  }

  const user = requiredEnv("GMAIL_USER")
  const pass = requiredEnv("GMAIL_APP_PASSWORD")

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  })
}

export async function sendMail(input: SendMailInput) {
  const transporter = createMailer()

  const fromName = (process.env.MAIL_FROM_NAME || "Sistema").trim()
  const gmailUser = requiredEnv("GMAIL_USER").trim()
  const fromEmail = (process.env.MAIL_FROM_EMAIL || gmailUser).trim()

  await transporter.sendMail({
    from: { name: fromName, address: fromEmail },
    to: input.to.trim(),
    subject: input.subject,
    text: input.text,
    html: input.html
  })
}
