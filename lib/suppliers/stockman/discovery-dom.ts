import type { StockmanCommercialRowSnapshot } from "./page-structure";

export function readStockmanCommercialRows(elements: Element[]): StockmanCommercialRowSnapshot[] {
  const seen = new Set<string>();
  const rows: StockmanCommercialRowSnapshot[] = [];
  for (const [rowIndex, element] of elements.entries()) {
    const referenceElement = element.querySelector(
      ".ref_article, [id*='rp_articles_ref_article']",
    );
    const reference = (referenceElement?.textContent ?? "").replace(/\u00a0/g, " ").trim();
    const text = (element.textContent ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (!reference || !text || referenceElement?.closest("tr") !== element) continue;
    // A confirmed article row inside STOCKMAN's article table is valid
    // even when no weight, barcode, price or stock is displayed.
    // Outside this table, keep the historical commercial-marker guard.
    const insideArticleTable = Boolean(element.closest("#Content_table_articles table"));
    if (!insideArticleTable && !/(?:Poids\s*:|Weight\s*:|Catalogue\b|€\s*HT|Prix\s+Unitaire\s+HT|Unit price|Code[- ]?barres?|Bar code|Stock\b)/i.test(text)) continue;
    const key = `${reference}::${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const table = element.closest("table");
    const section = element.closest("section, article, fieldset, .bloc, .block, [class*='option'], [class*='accessoir'], [class*='piece']");
    const headingScope = section ?? table?.parentElement;
    const precedingHeadings = headingScope
      ? [...headingScope.querySelectorAll("h1, h2, h3, h4, legend")]
        .filter((heading) => Boolean(heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))
        .slice(-1).map((heading) => heading.textContent ?? "")
      : [];
    const badgeTexts = [...element.querySelectorAll(".badge, .label, .tag, [class*='badge'], [class*='accessoir'], [class*='option'], span, strong")]
      .map((badge) => (badge.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter((label) => /^(?:accessoires?|options?|pi[eè]ces? d[eé]tach[eé]es?)$/i.test(label));
    const owner = section ?? table ?? element;
    const dataAttributes = [...owner.attributes]
      .filter((attribute) => attribute.name.startsWith("data-"))
      .map((attribute) => `${attribute.name}=${attribute.value}`);
    const descriptionNode = element.querySelector("[id*='rp_articles_desi_article']");
    const stockNode = element.querySelector("[id*='stock_article_td']");
    const priceNode = element.querySelector("[id*='price_by_qty_td']");
    const optionImageEvidence = [...element.querySelectorAll("img")]
      .filter(img => img.closest("tr") === element && (img.classList.contains("imgOption") || /(?:^|\/)Option_picto\.jpg(?:[?#]|$)/i.test(img.getAttribute("src") ?? "")))
      .map(img => `${img.getAttribute("class") ?? ""}|${img.getAttribute("src") ?? ""}`);
    rows.push({
      optionImageEvidence,
      description: descriptionNode?.closest("tr") === element ? (descriptionNode.textContent ?? "").replace(/\s+/g, " ").trim() : undefined,
      stockText: stockNode?.closest("tr") === element ? (stockNode.textContent ?? "").replace(/\s+/g, " ").trim() : undefined,
      priceText: priceNode?.closest("tr") === element ? (priceNode.textContent ?? "").replace(/\s+/g, " ").trim() : undefined,
      reference,
      text,
      badgeTexts,
      sectionLabels: precedingHeadings,
      ancestorClass: owner.getAttribute("class") ?? "",
      dataAttributes,
      // A generic commercial table is insufficient evidence of main variants.
      isPrimaryFamilyTable: Boolean(table?.matches("[data-relation=primary], [data-relation=primary-variant]") || table?.closest("#Content_table_articles") || precedingHeadings.some((label) => /^(?:variantes? principales?|primary variants?)$/i.test(label.trim()))),
      isCommercialTable: Boolean(table),
      rowIndex,
    });
  }
  return rows;
}

export function readStockmanPageStructure(input?: { root: Document; baseUrl: string }) {
  const root = input?.root ?? document;
  const baseUrl = input?.baseUrl ?? document.baseURI;
  const breadcrumb: string[] = [];
  const relatedProducts: Array<{
    url: string;
    label: string;
    relationType: "RECOMMENDED_PRODUCT";
  }> = [];

  const breadcrumbContainer = root.querySelector(
    ".container.content-ariane, #div_ariane_content .content-ariane, .content-ariane, [class*='breadcrumb']",
  );

  if (breadcrumbContainer) {
    const elements = breadcrumbContainer.querySelectorAll("a, span");
    for (const element of elements) {
      const value = (element.textContent ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (value) breadcrumb.push(value);
    }
  }

  const headings = root.querySelectorAll("h1, h2, h3, h4, strong");

  for (const heading of headings) {
    const headingText = (heading.textContent ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!/consultez\s+[ée]galement/i.test(headingText)) continue;

    const container =
      heading.closest("section, article, div, table") ??
      heading.parentElement;

    if (!container) continue;

    const anchors = container.querySelectorAll("a[href]");

    for (const anchor of anchors) {
      const url = (anchor as HTMLAnchorElement).href;
      const label = (
        anchor.textContent ??
        anchor.getAttribute("title") ??
        ""
      )
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!url) continue;

      let alreadyPresent = false;
      for (const item of relatedProducts) {
        if (item.url === url) {
          alreadyPresent = true;
          break;
        }
      }

      if (!alreadyPresent) {
        relatedProducts.push({
          url,
          label,
          relationType: "RECOMMENDED_PRODUCT",
        });
      }
    }
  }

  const nativeText = (selector: string) => root.querySelector<HTMLElement>(selector)?.textContent?.trim().slice(0, 6_000) || null;
  const technicalContainers = "#caractContent, #Content_caracteristique, #Content_caracteristique_technique_content, #Content_caract, #Content_caracteristiques";
  const familyTechnicalAssets = new Set<string>();
  const mediaCandidates = new Set<string>();
  for (const node of root.querySelectorAll("a[href], img[src], img[data-src], img[data-zoom-image]")) {
    for (const attribute of ["href", "src", "data-src", "data-zoom-image"]) {
      const value = node.getAttribute(attribute);
      if (!value) continue;
      try {
        const url = new URL(value, baseUrl);
        if (!/\.(?:pdf|jpe?g|png|webp)$/i.test(url.pathname)) continue;
        if (node.closest(technicalContainers)) {
          if (url.protocol === "https:" && ["www.stockman.fr", "stockman.fr"].includes(url.hostname)) familyTechnicalAssets.add(url.href);
        } else mediaCandidates.add(url.href);
      } catch { /* ignore invalid asset URLs */ }
    }
  }
  const technicalHeading = [...root.querySelectorAll("#Content_desc_long strong, #Content_desc_long b, #Content_desc_long h2, #descriptionContent h3")]
    .find((node) => /caract[ée]ristiques techniques|technical specifications/i.test(node.textContent ?? ""));
  const editorialTechnicalText = technicalHeading?.closest("li, p")?.textContent?.trim().slice(0, 6_000) || null;
  return {
    breadcrumb,
    relatedProducts,
    familyDescription: nativeText("#Content_desc_long, #descriptionContent"),
    familyTechnicalText: nativeText(technicalContainers) || editorialTechnicalText,
    familyTechnicalAssets: [...familyTechnicalAssets],
    mediaCandidates: [...mediaCandidates],
  };
}
