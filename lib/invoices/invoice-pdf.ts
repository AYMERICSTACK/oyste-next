import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { prisma } from "@/lib/db/prisma";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BOTTOM_LIMIT = 72;

const COLORS = {
  navy: rgb(0.055, 0.102, 0.18),
  teal: rgb(0, 0.5, 0.56),
  orange: rgb(0.92, 0.33, 0.08),
  slate: rgb(0.36, 0.42, 0.5),
  light: rgb(0.95, 0.97, 0.98),
  border: rgb(0.86, 0.89, 0.92),
  white: rgb(1, 1, 1),
};

function safeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function money(value: unknown, currency = "EUR") {
  const amount = Number(value ?? 0);
  const formatted = safeText(
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount),
  );
  return `${formatted} ${safeText(currency)}`;
}

function dateFr(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function addressLines(input: {
  address1?: string | null;
  address2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
}) {
  return [
    safeText(input.address1),
    safeText(input.address2),
    safeText(`${input.postalCode ?? ""} ${input.city ?? ""}`),
    safeText(input.country),
  ].filter(Boolean);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = safeText(text).split(" ").filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let line = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

function drawLines(
  page: PDFPage,
  lines: string[],
  options: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
  },
) {
  const lineHeight = options.lineHeight ?? options.size * 1.35;
  lines.forEach((line, index) => {
    page.drawText(safeText(line), {
      x: options.x,
      y: options.y - index * lineHeight,
      font: options.font,
      size: options.size,
      color: options.color ?? COLORS.navy,
    });
  });
  return options.y - lines.length * lineHeight;
}

export async function generateInvoicePdf(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      order: { select: { reference: true } },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!invoice) throw new Error("Facture introuvable.");
  if (invoice.status !== "ISSUED" || !invoice.number || !invoice.issuedAt) {
    throw new Error(
      "Le PDF ne peut être généré que pour une facture émise et numérotée.",
    );
  }
  if (!invoice.lines.length)
    throw new Error("La facture ne contient aucune ligne.");

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let page: PDFPage;
  let y = 0;

  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - 48;
    return page;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < BOTTOM_LIMIT) addPage();
  };

  addPage();

  // Header brand + invoice identity
  page!.drawText("OYSTE", {
    x: MARGIN_X,
    y,
    font: bold,
    size: 28,
    color: COLORS.teal,
  });
  page!.drawText("Une marque exploitée par ADEI", {
    x: MARGIN_X,
    y: y - 18,
    font: regular,
    size: 8.5,
    color: COLORS.slate,
  });

  page!.drawText("FACTURE", {
    x: PAGE_WIDTH - MARGIN_X - 120,
    y: y + 2,
    font: bold,
    size: 20,
    color: COLORS.navy,
  });
  page!.drawText(invoice.number, {
    x: PAGE_WIDTH - MARGIN_X - 170,
    y: y - 20,
    font: bold,
    size: 11,
    color: COLORS.orange,
  });
  y -= 58;

  page!.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 1.2,
    color: COLORS.teal,
  });
  y -= 24;

  // Meta strip
  const meta = [
    ["Date d'émission", dateFr(invoice.issuedAt)],
    ["Commande", safeText(invoice.order.reference)],
    ["Date de paiement", dateFr(invoice.paidAt)],
  ];
  const metaWidth = CONTENT_WIDTH / 3;
  meta.forEach(([label, value], index) => {
    const x = MARGIN_X + index * metaWidth;
    page!.drawText(label, {
      x,
      y,
      font: regular,
      size: 7.5,
      color: COLORS.slate,
    });
    page!.drawText(value, {
      x,
      y: y - 15,
      font: bold,
      size: 9.5,
      color: COLORS.navy,
    });
  });
  y -= 52;

  // Seller / buyer cards
  const gap = 18;
  const cardWidth = (CONTENT_WIDTH - gap) / 2;
  const cardTop = y;
  const cardHeight = 146;

  page!.drawRectangle({
    x: MARGIN_X,
    y: cardTop - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: COLORS.light,
    borderColor: COLORS.border,
    borderWidth: 0.7,
  });
  page!.drawRectangle({
    x: MARGIN_X + cardWidth + gap,
    y: cardTop - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 0.7,
  });

  const sellerX = MARGIN_X + 14;
  let sy = cardTop - 20;
  page!.drawText("EMETTEUR", {
    x: sellerX,
    y: sy,
    font: bold,
    size: 7.5,
    color: COLORS.teal,
  });
  sy -= 18;
  const sellerName = safeText(invoice.sellerName || "ADEI");
  sy = drawLines(page!, wrapText(sellerName, bold, 9.5, cardWidth - 28), {
    x: sellerX,
    y: sy,
    font: bold,
    size: 9.5,
    lineHeight: 12,
  });
  sy -= 2;
  const sellerLines = [
    ...addressLines({
      address1: invoice.sellerAddress1,
      address2: invoice.sellerAddress2,
      postalCode: invoice.sellerPostalCode,
      city: invoice.sellerCity,
      country: invoice.sellerCountry,
    }),
    invoice.sellerSiret ? `SIRET : ${invoice.sellerSiret}` : "",
    invoice.sellerSiren ? `SIREN : ${invoice.sellerSiren}` : "",
    invoice.sellerVatNumber ? `TVA : ${invoice.sellerVatNumber}` : "",
  ].filter(Boolean);
  drawLines(page!, sellerLines, {
    x: sellerX,
    y: sy,
    font: regular,
    size: 8,
    color: COLORS.slate,
    lineHeight: 11,
  });

  const buyerX = MARGIN_X + cardWidth + gap + 14;
  let by = cardTop - 20;
  page!.drawText("CLIENT", {
    x: buyerX,
    y: by,
    font: bold,
    size: 7.5,
    color: COLORS.orange,
  });
  by -= 18;
  const buyerPerson = safeText(
    `${invoice.buyerFirstName ?? ""} ${invoice.buyerLastName ?? ""}`,
  );
  const buyerName = safeText(
    invoice.buyerCompany || buyerPerson || invoice.buyerEmail || "Client",
  );
  by = drawLines(page!, wrapText(buyerName, bold, 9.5, cardWidth - 28), {
    x: buyerX,
    y: by,
    font: bold,
    size: 9.5,
    lineHeight: 12,
  });
  by -= 2;
  const buyerLines = [
    ...addressLines({
      address1: invoice.buyerAddress1,
      address2: invoice.buyerAddress2,
      postalCode: invoice.buyerPostalCode,
      city: invoice.buyerCity,
      country: invoice.buyerCountry,
    }),
    invoice.buyerSiret ? `SIRET : ${invoice.buyerSiret}` : "",
    invoice.buyerSiren ? `SIREN : ${invoice.buyerSiren}` : "",
    invoice.buyerVatNumber ? `TVA : ${invoice.buyerVatNumber}` : "",
  ].filter(Boolean);
  drawLines(page!, buyerLines, {
    x: buyerX,
    y: by,
    font: regular,
    size: 8,
    color: COLORS.slate,
    lineHeight: 11,
  });

  y = cardTop - cardHeight - 28;

  // Table helpers
  const cols = {
    designation: { x: MARGIN_X + 8, width: 228 },
    qty: { x: MARGIN_X + 244, width: 34 },
    unit: { x: MARGIN_X + 286, width: 72 },
    vat: { x: MARGIN_X + 366, width: 47 },
    total: { x: MARGIN_X + 421, width: 70 },
  };

  const drawTableHeader = () => {
    ensureSpace(34);
    page!.drawRectangle({
      x: MARGIN_X,
      y: y - 24,
      width: CONTENT_WIDTH,
      height: 24,
      color: COLORS.navy,
    });
    const headerY = y - 16;
    page!.drawText("DESIGNATION", {
      x: cols.designation.x,
      y: headerY,
      font: bold,
      size: 7.5,
      color: COLORS.white,
    });
    page!.drawText("QTE", {
      x: cols.qty.x,
      y: headerY,
      font: bold,
      size: 7.5,
      color: COLORS.white,
    });
    page!.drawText("PU HT", {
      x: cols.unit.x,
      y: headerY,
      font: bold,
      size: 7.5,
      color: COLORS.white,
    });
    page!.drawText("TVA", {
      x: cols.vat.x,
      y: headerY,
      font: bold,
      size: 7.5,
      color: COLORS.white,
    });
    page!.drawText("TOTAL HT", {
      x: cols.total.x,
      y: headerY,
      font: bold,
      size: 7.5,
      color: COLORS.white,
    });
    y -= 24;
  };

  drawTableHeader();

  for (const line of invoice.lines) {
    const title = line.reference
      ? `${line.reference} - ${line.name}`
      : line.name;
    const wrapped = wrapText(title, regular, 8.2, cols.designation.width - 10);
    const rowHeight = Math.max(30, 13 + wrapped.length * 10);

    if (y - rowHeight < BOTTOM_LIMIT + 35) {
      addPage();
      page!.drawText(`${invoice.number} - suite`, {
        x: MARGIN_X,
        y,
        font: bold,
        size: 9,
        color: COLORS.slate,
      });
      y -= 24;
      drawTableHeader();
    }

    page!.drawRectangle({
      x: MARGIN_X,
      y: y - rowHeight,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 0.5,
    });
    drawLines(page!, wrapped, {
      x: cols.designation.x,
      y: y - 14,
      font: regular,
      size: 8.2,
      lineHeight: 10,
    });
    page!.drawText(String(line.quantity), {
      x: cols.qty.x,
      y: y - 17,
      font: regular,
      size: 8.2,
      color: COLORS.navy,
    });
    page!.drawText(money(line.unitPriceHt, invoice.currency), {
      x: cols.unit.x,
      y: y - 17,
      font: regular,
      size: 7.6,
      color: COLORS.navy,
    });
    page!.drawText(`${Number(line.vatRate).toFixed(2)} %`, {
      x: cols.vat.x,
      y: y - 17,
      font: regular,
      size: 7.6,
      color: COLORS.navy,
    });
    page!.drawText(money(line.totalHt, invoice.currency), {
      x: cols.total.x,
      y: y - 17,
      font: bold,
      size: 7.6,
      color: COLORS.navy,
    });
    y -= rowHeight;
  }

  y -= 24;
  ensureSpace(160);

  // Payment note and totals
  const paymentText =
    invoice.paymentMethod === "CARD"
      ? "Carte bancaire"
      : invoice.paymentMethod === "BANK_TRANSFER"
        ? "Virement bancaire"
        : safeText(invoice.paymentMethod);
  page!.drawText("PAIEMENT", {
    x: MARGIN_X,
    y,
    font: bold,
    size: 8,
    color: COLORS.teal,
  });
  page!.drawText(`Mode : ${paymentText || "-"}`, {
    x: MARGIN_X,
    y: y - 18,
    font: regular,
    size: 8.5,
    color: COLORS.slate,
  });
  page!.drawText(
    `Statut : ${invoice.paymentStatus === "PAID" ? "Payé" : safeText(invoice.paymentStatus)}`,
    { x: MARGIN_X, y: y - 32, font: regular, size: 8.5, color: COLORS.slate },
  );

  const totalsX = PAGE_WIDTH - MARGIN_X - 210;
  const totalsW = 210;
  page!.drawRectangle({
    x: totalsX,
    y: y - 92,
    width: totalsW,
    height: 102,
    color: COLORS.light,
    borderColor: COLORS.border,
    borderWidth: 0.7,
  });
  const totalRows = [
    ["Total HT", money(invoice.subtotalHt, invoice.currency)],
    ["TVA", money(invoice.taxAmount, invoice.currency)],
    ["TOTAL TTC", money(invoice.totalTtc, invoice.currency)],
  ];
  totalRows.forEach(([label, value], index) => {
    const rowY = y - 18 - index * 28;
    page!.drawText(label, {
      x: totalsX + 14,
      y: rowY,
      font: index === 2 ? bold : regular,
      size: index === 2 ? 10 : 8.5,
      color: index === 2 ? COLORS.navy : COLORS.slate,
    });
    const valueWidth = (index === 2 ? bold : regular).widthOfTextAtSize(
      value,
      index === 2 ? 10 : 8.5,
    );
    page!.drawText(value, {
      x: totalsX + totalsW - 14 - valueWidth,
      y: rowY,
      font: index === 2 ? bold : regular,
      size: index === 2 ? 10 : 8.5,
      color: index === 2 ? COLORS.orange : COLORS.navy,
    });
  });
  y -= 120;

  ensureSpace(85);
  page!.drawText("INFORMATIONS", {
    x: MARGIN_X,
    y,
    font: bold,
    size: 8,
    color: COLORS.teal,
  });
  y -= 17;
  const infoLines = [
    `Facture émise par ${safeText(invoice.sellerName || "ADEI")} sous la marque OYSTE.`,
    `Référence commande : ${safeText(invoice.order.reference)}.`,
  ];
  drawLines(page!, infoLines, {
    x: MARGIN_X,
    y,
    font: regular,
    size: 7.6,
    color: COLORS.slate,
    lineHeight: 11,
  });

  // Footer on every page
  pages.forEach((p, index) => {
    p.drawLine({
      start: { x: MARGIN_X, y: 46 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 46 },
      thickness: 0.5,
      color: COLORS.border,
    });
    p.drawText(
      `${safeText(invoice.number)} - page ${index + 1}/${pages.length}`,
      { x: MARGIN_X, y: 30, font: regular, size: 7, color: COLORS.slate },
    );
    const footerRight = "OYSTE / ADEI";
    p.drawText(footerRight, {
      x: PAGE_WIDTH - MARGIN_X - regular.widthOfTextAtSize(footerRight, 7),
      y: 30,
      font: regular,
      size: 7,
      color: COLORS.slate,
    });
  });

  const bytes = await pdf.save();
  return {
    bytes,
    filename: `${invoice.number}.pdf`,
    invoiceNumber: invoice.number,
  };
}
