export async function sendOysteEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY absent : email non envoyé", input.subject);
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ORDER_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || "OYSTE <onboarding@resend.dev>",
      to: [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: process.env.CONTACT_TO_EMAIL,
    }),
  });
  if (!response.ok) console.error("OYSTE email error", response.status, await response.text());
  return response.ok;
}
