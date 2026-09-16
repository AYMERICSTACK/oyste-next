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
function shell(content: string, headerLabel = "Confirmation de commande") {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:700px;background:#fff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden"><tr><td style="background:#071827;padding:28px 34px;color:#fff"><div style="font-size:25px;font-weight:900;letter-spacing:2px">OYSTE<span style="color:#f25a1d">.</span></div><div style="margin-top:7px;color:#a7c9cf;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">${escapeHtml(headerLabel)}</div></td></tr><tr><td style="padding:34px">${content}</td></tr><tr><td style="padding:22px 34px;background:#f8fafc;color:#64748b;font-size:12px;line-height:20px;border-top:1px solid #e2e8f0">OYSTE — Plateforme professionnelle dédiée aux équipements industriels. Les informations légales et bancaires figurent sur les documents de commande.</td></tr></table></td></tr></table></body></html>`;
}
export function buildBankTransferOrderEmail(data: OrderEmailData) {
  const lines = data.items.map((item) => `<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0"><strong>${escapeHtml(item.name)}</strong><br><span style="color:#64748b;font-size:12px">${escapeHtml(item.reference || "Référence personnalisée")} · Qté ${item.quantity}</span></td><td align="right" style="padding:9px 0;border-bottom:1px solid #e2e8f0;font-weight:700">${money(item.totalHt, data.currency)} HT</td></tr>`).join("");
  const paymentBlock = data.requiresShippingConfirmation
    ? `<div style="margin-top:26px;padding:22px;border-radius:16px;background:#fff7ed;border:1px solid #fed7aa"><strong style="color:#9a3412">Montant de transport à confirmer</strong><p style="margin:8px 0 0;color:#7c2d12;line-height:23px">Notre équipe vous transmettra le montant définitif avant votre règlement. Merci de ne pas effectuer le virement avant cette confirmation.</p></div>`
    : `<div style="margin-top:26px;padding:22px;border-radius:16px;background:#ecfeff;border:1px solid #a5f3fc"><p style="margin:0 0 14px;color:#155e75;font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase">Paiement par virement</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:6px 0;color:#64748b">Titulaire</td><td align="right" style="font-weight:800">${escapeHtml(bankTransferDetails.accountHolder)}</td></tr><tr><td style="padding:6px 0;color:#64748b">IBAN</td><td align="right" style="font-weight:800">${formatIban(bankTransferDetails.iban)}</td></tr><tr><td style="padding:6px 0;color:#64748b">BIC</td><td align="right" style="font-weight:800">${bankTransferDetails.bic}</td></tr><tr><td style="padding:6px 0;color:#64748b">Référence obligatoire</td><td align="right" style="font-weight:900;color:#f25a1d">${data.reference}</td></tr></table><p style="margin:16px 0 0;color:#155e75;font-size:13px;line-height:21px">Indiquez impérativement la référence <strong>${data.reference}</strong> dans le libellé du virement.</p></div>`;
  return shell(`<p style="margin:0;color:#f25a1d;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Commande enregistrée</p><h1 style="margin:12px 0 10px;font-size:30px;line-height:38px">Bonjour ${escapeHtml(data.firstName || "")},</h1><p style="margin:0;color:#475569;font-size:16px;line-height:27px">Votre commande <strong>${data.reference}</strong> pour <strong>${escapeHtml(data.company)}</strong> a bien été enregistrée.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:25px;border-collapse:collapse">${lines}</table><div style="margin-top:18px;text-align:right;font-size:20px;font-weight:900">Total TTC : ${money(data.totalTtc, data.currency)}${data.requiresShippingConfirmation ? " hors transport à confirmer" : ""}</div>${paymentBlock}<p style="margin:26px 0 0;color:#475569;font-size:14px;line-height:24px">Le traitement de votre commande débute après réception et validation du règlement.<br><strong>L’équipe OYSTE</strong></p>`);
}


type SimpleOrderEmailData = {
  reference: string;
  firstName?: string | null;
  company?: string | null;
  totalTtc: number;
  currency?: string;
};

export function buildCardOrderConfirmationEmail(data: SimpleOrderEmailData) {
  const currency = data.currency || "EUR";
  return shell(`<p style="margin:0;color:#f25a1d;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Commande enregistrée</p><h1 style="margin:12px 0 10px;font-size:30px;line-height:38px">Bonjour ${escapeHtml(data.firstName || "")},</h1><p style="margin:0;color:#475569;font-size:16px;line-height:27px">Votre commande <strong>${escapeHtml(data.reference)}</strong>${data.company ? ` pour <strong>${escapeHtml(data.company)}</strong>` : ""} a bien été enregistrée.</p><div style="margin-top:24px;padding:20px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0"><span style="color:#64748b">Montant TTC</span><strong style="float:right;font-size:20px">${money(data.totalTtc, currency)}</strong></div><p style="margin:24px 0 0;color:#475569;font-size:14px;line-height:24px">Votre paiement est en cours de validation. Vous recevrez une confirmation distincte dès qu’il sera confirmé.<br><strong>L’équipe OYSTE</strong></p>`);
}

export function buildPaymentConfirmationEmail(data: SimpleOrderEmailData) {
  const currency = data.currency || "EUR";
  return shell(`<p style="margin:0;color:#059669;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Paiement confirmé</p><h1 style="margin:12px 0 10px;font-size:30px;line-height:38px">Bonjour ${escapeHtml(data.firstName || "")},</h1><p style="margin:0;color:#475569;font-size:16px;line-height:27px">Nous vous confirmons la réception du paiement de votre commande <strong>${escapeHtml(data.reference)}</strong>.</p><div style="margin-top:24px;padding:20px;border-radius:16px;background:#ecfdf5;border:1px solid #a7f3d0"><span style="color:#047857">Montant réglé</span><strong style="float:right;color:#065f46;font-size:20px">${money(data.totalTtc, currency)}</strong></div><p style="margin:24px 0 0;color:#475569;font-size:14px;line-height:24px">Votre commande peut maintenant poursuivre son traitement. La facture définitive sera mise à disposition dans votre espace client dès son émission par notre service facturation.<br><strong>L’équipe OYSTE</strong></p>`, "Confirmation de paiement");
}

export function buildInternalNewOrderEmail(data: {
  reference: string;
  company: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: "BANK_TRANSFER" | "CARD";
  totalTtc: number;
  currency?: string;
  shippingAddress: { address1: string; address2?: string | null; postalCode: string; city: string; country: string };
}) {
  const currency = data.currency || "EUR";
  const payment = data.paymentMethod === "BANK_TRANSFER" ? "Virement bancaire" : "Carte bancaire / Stripe";
  const address = [data.shippingAddress.address1, data.shippingAddress.address2, `${data.shippingAddress.postalCode} ${data.shippingAddress.city}`, data.shippingAddress.country].filter(Boolean).map((line) => escapeHtml(String(line))).join("<br>");
  return shell(`<p style="margin:0;color:#f25a1d;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Nouvelle commande OYSTE</p><h1 style="margin:12px 0 10px;font-size:30px;line-height:38px">${escapeHtml(data.reference)}</h1><p style="margin:0;color:#475569;font-size:16px;line-height:27px"><strong>${escapeHtml(data.company)}</strong> vient d’enregistrer une nouvelle commande.</p><div style="margin-top:24px;padding:20px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:6px 0;color:#64748b">Client</td><td align="right" style="font-weight:800">${escapeHtml(data.customerName)}</td></tr><tr><td style="padding:6px 0;color:#64748b">E-mail</td><td align="right" style="font-weight:800">${escapeHtml(data.customerEmail)}</td></tr><tr><td style="padding:6px 0;color:#64748b">Paiement</td><td align="right" style="font-weight:800">${payment}</td></tr><tr><td style="padding:6px 0;color:#64748b">Total TTC</td><td align="right" style="font-weight:900;font-size:18px">${money(data.totalTtc, currency)}</td></tr></table></div><div style="margin-top:20px;padding:20px;border-radius:16px;background:#ecfeff;border:1px solid #a5f3fc"><strong style="color:#155e75">Adresse de livraison</strong><p style="margin:8px 0 0;color:#475569;line-height:22px">${address}</p></div><p style="margin:24px 0 0;color:#475569;font-size:14px;line-height:24px">La commande est disponible dans le back-office OYSTE.</p>`, "Nouvelle commande");
}

export function buildInvoiceAvailableEmail(data: { firstName?: string | null; reference: string; invoiceNumber?: string | null; accountUrl: string }) {
  return shell(`<p style="margin:0;color:#007f8f;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Facture disponible</p><h1 style="margin:12px 0 10px;font-size:30px;line-height:38px">Bonjour ${escapeHtml(data.firstName || "")},</h1><p style="margin:0;color:#475569;font-size:16px;line-height:27px">Votre facture${data.invoiceNumber ? ` <strong>${escapeHtml(data.invoiceNumber)}</strong>` : ""} relative à la commande <strong>${escapeHtml(data.reference)}</strong> est désormais disponible dans votre espace client.</p><p style="margin:26px 0"><a href="${escapeHtml(data.accountUrl)}" style="display:inline-block;background:#007f8f;color:white;text-decoration:none;font-weight:900;padding:14px 22px;border-radius:12px">Accéder à mes factures</a></p><p style="margin:0;color:#475569;font-size:14px;line-height:24px">Vous pourrez la consulter et la télécharger à tout moment depuis votre espace sécurisé.<br><strong>L’équipe OYSTE</strong></p>`, "Facture disponible");
}
