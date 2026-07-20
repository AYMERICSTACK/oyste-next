export const contactSubjectLabels: Record<string, string> = {
  DEVIS: "Demande de devis",
  CONSEIL: "Conseil produit",
  CONFIGURATION: "Projet sur mesure",
  COMMANDE: "Suivi de commande",
  SAV: "Service après-vente",
  COMMERCIAL: "Échange commercial",
  AUTRE: "Autre demande",
};

type ContactEmailData = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shell(content: string) {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e2e8f0">
          <tr><td style="background:#071827;padding:28px 34px;color:#ffffff">
            <div style="font-size:25px;font-weight:900;letter-spacing:2px">OYSTE<span style="color:#f25a1d">.</span></div>
            <div style="margin-top:7px;color:#a7c9cf;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Le levage industriel, autrement</div>
          </td></tr>
          <tr><td style="padding:34px">${content}</td></tr>
          <tr><td style="padding:22px 34px;background:#f8fafc;color:#64748b;font-size:12px;line-height:20px;border-top:1px solid #e2e8f0">
            Ce message a été envoyé automatiquement depuis le formulaire de contact OYSTE.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function buildAdminContactEmail(data: ContactEmailData) {
  const subjectLabel = contactSubjectLabels[data.subject] || contactSubjectLabels.AUTRE;
  const fullName = `${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}`;

  return shell(`
    <p style="margin:0;color:#f25a1d;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Nouvelle demande</p>
    <h1 style="margin:12px 0 8px;font-size:30px;line-height:38px">${subjectLabel}</h1>
    <p style="margin:0 0 26px;color:#64748b;font-size:15px;line-height:24px">Une nouvelle demande vient d’être transmise depuis le site OYSTE.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
      <tr><td style="padding:10px 0;color:#64748b;width:150px">Contact</td><td style="padding:10px 0;font-weight:700">${fullName}</td></tr>
      <tr><td style="padding:10px 0;color:#64748b">Société</td><td style="padding:10px 0;font-weight:700">${escapeHtml(data.company)}</td></tr>
      <tr><td style="padding:10px 0;color:#64748b">E-mail</td><td style="padding:10px 0;font-weight:700"><a href="mailto:${escapeHtml(data.email)}" style="color:#007f8f">${escapeHtml(data.email)}</a></td></tr>
      <tr><td style="padding:10px 0;color:#64748b">Téléphone</td><td style="padding:10px 0;font-weight:700">${escapeHtml(data.phone || "Non renseigné")}</td></tr>
    </table>
    <div style="margin-top:26px;padding:22px;border-radius:16px;background:#f8fafc;border-left:4px solid #007f8f">
      <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase">Message</p>
      <p style="margin:0;white-space:pre-wrap;font-size:15px;line-height:25px">${escapeHtml(data.message)}</p>
    </div>
  `);
}

export function buildCustomerConfirmationEmail(data: ContactEmailData) {
  const subjectLabel = contactSubjectLabels[data.subject] || contactSubjectLabels.AUTRE;

  return shell(`
    <p style="margin:0;color:#f25a1d;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase">Demande bien reçue</p>
    <h1 style="margin:12px 0 14px;font-size:30px;line-height:38px">Bonjour ${escapeHtml(data.firstName)},</h1>
    <p style="margin:0;color:#475569;font-size:16px;line-height:27px">
      Merci d’avoir contacté OYSTE au sujet de votre demande « <strong>${subjectLabel}</strong> ».
      Notre équipe va l’étudier et reviendra vers vous dans les meilleurs délais.
    </p>
    <div style="margin-top:26px;padding:22px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0">
      <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase">Récapitulatif</p>
      <p style="margin:0;white-space:pre-wrap;font-size:14px;line-height:24px;color:#334155">${escapeHtml(data.message)}</p>
    </div>
    <p style="margin:26px 0 0;color:#475569;font-size:15px;line-height:25px">À très bientôt,<br><strong>L’équipe OYSTE</strong></p>
  `);
}
