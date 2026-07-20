import { bankTransferDetails, formatIban } from "./bank-transfer";

type OrderEmailData = {
  reference: string;
  firstName: string;
  company: string;
  totalTtc: number;
  currency: string;
  requiresShippingConfirmation: boolean;
  items: Array<{ name: string; reference?: string | null; quantity: number; totalHt: number }>;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value);
}
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function shell(content: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:700px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden"><tr><td style="background:#071827;padding:28px 34px;color:#fff"><div style="font-size:25px;font-weight:900;letter-spacing:2px">OYSTE<span style="color:#f25a1d">.</span></div><div style="margin-top:7px;color:#a7c9cf;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Confirmation de commande professionnelle</div></td></tr><tr><td style="padding:34px">${content}</td></tr><tr><td style="padding:22px 34px;background:#f8fafc;color:#64748b;font-size:12px;line-height:20px;border-top:1px solid #e2e8f0">OYSTE — Plateforme professionnelle dédiée aux équipements industriels. Les informations légales et bancaires figurent sur les documents de commande.</td></tr></table></td></tr></table></body></html>`;
}
export function buildBankTransferOrderEmail(data: OrderEmailData) {
  const lines = data.items.map((item) => `<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0"><strong>${escapeHtml(item.name)}</strong><br><span style="color:#64748b;font-size:12px">${escapeHtml(item.reference || "Référence personnalisée")} · Qté ${item.quantity}</span></td><td align="right" style="padding:9px 0;border-bottom:1px solid #e2e8f0;font-weight:700">${money(item.totalHt, data.currency)} HT</td></tr>`).join("");
  const paymentBlock = data.requiresShippingConfirmation
    ? `<div style="margin-top:26px;padding:22px;border-radius:16px;background:#fff7ed;border:1px solid #fed7aa"><strong style="color:#9a3412">Montant de transport à confirmer</strong><p style="margin:8px 0 0;color:#7c2d12;line-height:23px">Notre équipe vous transmettra le montant définitif avant votre règlement. Merci de ne pas effectuer le virement avant cette confirmation.</p></div>`
    : `<div style="margin-top:26px;padding:22px;border-radius:16px;background:#ecfeff;border:1px solid #a5f3fc"><p style="margin:0 0 14px;color:#155e75;font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase">Paiement par virement</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:6px 0;color:#64748b">Titulaire</td><td align="right" style="font-weight:800">${escapeHtml(bankTransferDetails.accountHolder)}</td></tr><tr><td style="padding:6px 0;color:#64748b">IBAN</td><td align="right" style="font-weight:800">${formatIban(bankTransferDetails.iban)}</td></tr><tr><td style="padding:6px 0;color:#64748b">BIC</td><td align="right" style="font-weight:800">${bankTransferDetails.bic}</td></tr><tr><td style="padding:6px 0;color:#64748b">Référence obligatoire</td><td align="right" style="font-weight:900;color:#f25a1d">${data.reference}</td></tr></table><p style="margin:16px 0 0;color:#155e75;font-size:13px;line-height:21px">Indiquez impérativement la référence <strong>${data.reference}</strong> dans le libellé du virement.</p></div>`;
  return shell(`<p style="margin:0;color:#f25a1d;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Commande enregistrée</p><h1 style="margin:12px 0 10px;font-size:30px;line-height:38px">Bonjour ${escapeHtml(data.firstName || "")},</h1><p style="margin:0;color:#475569;font-size:16px;line-height:27px">Votre commande <strong>${data.reference}</strong> pour <strong>${escapeHtml(data.company)}</strong> a bien été enregistrée.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:25px;border-collapse:collapse">${lines}</table><div style="margin-top:18px;text-align:right;font-size:20px;font-weight:900">Total TTC : ${money(data.totalTtc, data.currency)}${data.requiresShippingConfirmation ? " hors transport à confirmer" : ""}</div>${paymentBlock}<p style="margin:26px 0 0;color:#475569;font-size:14px;line-height:24px">Le traitement de votre commande débute après réception et validation du règlement.<br><strong>L’équipe OYSTE</strong></p>`);
}
