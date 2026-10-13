import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { commercialRows } from "../catalog-scanner";
import { classifyCommercialRow } from "../page-structure";

test("STOCKMAN : tableau familial, table ordinaire et accessoire", async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    await page.setContent(`
      <div id="Content_table_articles">
        <table>
          <tbody>
            ${[
              "AC201500",
              "AC201800",
              "AC202000",
              "AC20L1500",
              "AC20L1800",
              "AC20L2000",
            ]
              .map(
                (reference) => `
                  <tr>
                    <td class="ref_article">${reference}</td>
                    <td>Stock : 10</td>
                    <td>Prix Unitaire HT : 409 € HT</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <table id="ordinary-table">
        <tr>
          <td class="ref_article">ORDINARY123</td>
          <td>Stock : 5</td>
        </tr>
      </table>

      <section class="accessoires">
        <h2>Accessoires</h2>
        <table>
          <tr>
            <td class="ref_article">ACCESSORY123</td>
            <td><span class="badge">Accessoire</span></td>
            <td>Stock : 2</td>
          </tr>
        </table>
      </section>
    `);

    const rows = await commercialRows(page);

    const familyReferences = [
      "AC201500",
      "AC201800",
      "AC202000",
      "AC20L1500",
      "AC20L1800",
      "AC20L2000",
    ];

    for (const reference of familyReferences) {
      const row = rows.find((item) => item.reference === reference);

      assert.ok(row, `Référence absente : ${reference}`);
      assert.equal(
        row.isPrimaryFamilyTable,
        true,
        `${reference} doit être dans le tableau familial`,
      );
    }

    const ordinary = rows.find(
      (item) => item.reference === "ORDINARY123",
    );

    assert.ok(ordinary);
    assert.equal(ordinary.isPrimaryFamilyTable, false);

    const accessory = rows.find(
      (item) => item.reference === "ACCESSORY123",
    );

    assert.ok(accessory);
    assert.equal(accessory.isPrimaryFamilyTable, false);

    assert.equal(rows.length, 8);
  } finally {
    await browser.close();
  }
});