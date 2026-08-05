/**
 * Gerador de PDF pra orçamentos e contratos.
 * Usa pdfkit puro (sem headless browser) — leve, rápido, funciona em qualquer Docker.
 */
import PDFDocument from "pdfkit";
import { db } from "../db/client";

export interface DocumentData {
  id: number;
  number: number;
  type: "quote" | "contract";
  revision: number;
  client_name: string;
  client_document: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  tax_cents: number;
  terms: string | null;
  payment_terms: string | null;
  validity_days: number | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  tenant_id: number;
}

export interface DocumentItem {
  position: number;
  code: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price_cents: number;
  discount_cents: number;
  subtotal_cents: number;
}

// Cores do FJN brand
const COLORS = {
  navy: "#0B1340",
  orange: "#FFBA00",
  gray: "#666666",
  light: "#F8F9FA",
  border: "#E5E7EB",
  text: "#222222",
};

function money(cents: number | string): string {
  const n = Number(cents) / 100;
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Gera PDF de orçamento/contrato em memória e retorna Buffer.
 */
export async function generateDocumentPdf(documentId: number): Promise<Buffer> {
  // Carrega dados
  const docRes = await db.query(
    `SELECT d.*, t.name AS tenant_name, t.slug AS tenant_slug,
            t.email AS tenant_email, t.phone AS tenant_phone,
            t.branding AS tenant_branding
       FROM documents d
       JOIN tenants t ON t.id = d.tenant_id
      WHERE d.id = $1`,
    [documentId],
  );
  if (docRes.rowCount === 0) throw new Error("Documento não encontrado");
  const doc = docRes.rows[0];

  const itemsRes = await db.query(
    `SELECT * FROM document_items WHERE document_id = $1 ORDER BY position ASC, id ASC`,
    [documentId],
  );
  const items: DocumentItem[] = itemsRes.rows;

  const tenantName = doc.tenant_branding?.company_name_override ?? doc.tenant_name;
  const primaryColor = doc.tenant_branding?.accent_color ?? COLORS.orange;
  const isContract = doc.type === "contract";
  const docLabel = isContract ? "CONTRATO" : "ORÇAMENTO";

  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `${docLabel} #${doc.number} — ${tenantName}`,
        Author: tenantName,
        Subject: `${docLabel} para ${doc.client_name ?? "cliente"}`,
      },
    });

    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    // ========== HEADER ==========
    pdf.rect(0, 0, 595, 90).fill(COLORS.navy);
    pdf.fillColor(primaryColor).font("Helvetica-Bold").fontSize(24);
    pdf.text(tenantName, 40, 28);
    pdf.fillColor("#FFFFFF").font("Helvetica").fontSize(9);
    pdf.text(`${doc.tenant_email ?? ""}  ${doc.tenant_phone ?? ""}`, 40, 58);

    pdf.fillColor(primaryColor).font("Helvetica-Bold").fontSize(16);
    pdf.text(`${docLabel} Nº ${String(doc.number).padStart(4, "0")}`, 340, 28, {
      width: 215, align: "right",
    });
    pdf.fillColor("#FFFFFF").font("Helvetica").fontSize(9);
    pdf.text(`Emitido: ${fmtDate(doc.created_at)}`, 340, 52, { width: 215, align: "right" });
    if (doc.expires_at && !isContract) {
      pdf.text(`Válido até: ${fmtDate(doc.expires_at)}`, 340, 66, { width: 215, align: "right" });
    }
    if (doc.revision > 1) {
      pdf.fillColor(primaryColor);
      pdf.text(`Revisão ${doc.revision}`, 340, 78, { width: 215, align: "right" });
    }

    pdf.moveDown(3);
    pdf.y = 120;

    // ========== CLIENTE ==========
    pdf.fillColor(COLORS.navy).font("Helvetica-Bold").fontSize(11);
    pdf.text("CLIENTE", 40, pdf.y);
    pdf.moveDown(0.3);

    pdf.rect(40, pdf.y, 515, 60).fillAndStroke(COLORS.light, COLORS.border);
    const clientTop = pdf.y + 8;
    pdf.fillColor(COLORS.text).font("Helvetica-Bold").fontSize(11);
    pdf.text(doc.client_name ?? "—", 50, clientTop);
    pdf.font("Helvetica").fontSize(9).fillColor(COLORS.gray);
    let line = 0;
    if (doc.client_document) { pdf.text(`Documento: ${doc.client_document}`, 50, clientTop + 16 + line * 11); line++; }
    if (doc.client_phone)    { pdf.text(`Telefone: ${doc.client_phone}`, 50, clientTop + 16 + line * 11); line++; }
    if (doc.client_email)    { pdf.text(`E-mail: ${doc.client_email}`, 50, clientTop + 16 + line * 11); line++; }
    if (doc.client_address)  { pdf.text(`Endereço: ${doc.client_address}`, 50, clientTop + 16 + line * 11); line++; }
    pdf.y = clientTop + 70;

    pdf.moveDown(1.5);

    // ========== ITENS ==========
    pdf.fillColor(COLORS.navy).font("Helvetica-Bold").fontSize(11);
    pdf.text("ITENS", 40, pdf.y);
    pdf.moveDown(0.3);

    // Cabeçalho tabela
    const tableTop = pdf.y;
    pdf.rect(40, tableTop, 515, 22).fill(primaryColor);
    pdf.fillColor(COLORS.navy).font("Helvetica-Bold").fontSize(9);
    pdf.text("#", 45, tableTop + 7, { width: 20 });
    pdf.text("DESCRIÇÃO", 70, tableTop + 7, { width: 245 });
    pdf.text("QTD", 320, tableTop + 7, { width: 40, align: "right" });
    pdf.text("UNIT.", 365, tableTop + 7, { width: 70, align: "right" });
    pdf.text("SUBTOTAL", 440, tableTop + 7, { width: 110, align: "right" });

    pdf.y = tableTop + 22;

    // Rows
    pdf.font("Helvetica").fontSize(9).fillColor(COLORS.text);
    for (const item of items) {
      const rowTop = pdf.y;
      const rowHeight = Math.max(20, Math.ceil(item.description.length / 40) * 12 + 8);

      // Zebra
      if (item.position % 2 === 1) {
        pdf.rect(40, rowTop, 515, rowHeight).fill(COLORS.light);
      }

      pdf.fillColor(COLORS.text);
      pdf.text(String(item.position + 1), 45, rowTop + 6, { width: 20 });
      pdf.text(
        (item.code ? `[${item.code}] ` : "") + item.description,
        70, rowTop + 6, { width: 245 },
      );
      pdf.text(
        `${Number(item.quantity).toLocaleString("pt-BR")} ${item.unit ?? ""}`,
        320, rowTop + 6, { width: 40, align: "right" },
      );
      pdf.text(money(item.unit_price_cents), 365, rowTop + 6, { width: 70, align: "right" });
      pdf.font("Helvetica-Bold");
      pdf.text(money(item.subtotal_cents), 440, rowTop + 6, { width: 110, align: "right" });
      pdf.font("Helvetica");

      pdf.y = rowTop + rowHeight;

      // Nova página se ficar sem espaço
      if (pdf.y > 700) {
        pdf.addPage();
        pdf.y = 40;
      }
    }

    pdf.moveDown(1);

    // ========== TOTAIS ==========
    const totalsX = 340;
    const totalsWidth = 215;
    const totalsTop = pdf.y;
    pdf.rect(totalsX, totalsTop, totalsWidth, 90).stroke(COLORS.border);

    pdf.fillColor(COLORS.text).font("Helvetica").fontSize(10);
    pdf.text("Subtotal:", totalsX + 10, totalsTop + 10, { width: 100 });
    pdf.text(money(doc.subtotal_cents), totalsX + 110, totalsTop + 10, { width: 95, align: "right" });

    if (Number(doc.discount_cents) > 0) {
      pdf.fillColor(COLORS.gray);
      pdf.text("Desconto:", totalsX + 10, totalsTop + 28, { width: 100 });
      pdf.text(`- ${money(doc.discount_cents)}`, totalsX + 110, totalsTop + 28, { width: 95, align: "right" });
    }

    if (Number(doc.tax_cents) > 0) {
      pdf.fillColor(COLORS.gray);
      pdf.text("Impostos:", totalsX + 10, totalsTop + 46, { width: 100 });
      pdf.text(money(doc.tax_cents), totalsX + 110, totalsTop + 46, { width: 95, align: "right" });
    }

    // Total em destaque
    pdf.rect(totalsX, totalsTop + 60, totalsWidth, 30).fill(primaryColor);
    pdf.fillColor(COLORS.navy).font("Helvetica-Bold").fontSize(13);
    pdf.text("TOTAL:", totalsX + 10, totalsTop + 70, { width: 100 });
    pdf.text(money(doc.total_cents), totalsX + 110, totalsTop + 70, { width: 95, align: "right" });

    pdf.y = totalsTop + 100;
    pdf.moveDown(1);

    // ========== CONDIÇÕES ==========
    if (doc.payment_terms) {
      pdf.fillColor(COLORS.navy).font("Helvetica-Bold").fontSize(10);
      pdf.text("CONDIÇÕES DE PAGAMENTO", 40, pdf.y);
      pdf.moveDown(0.3);
      pdf.font("Helvetica").fontSize(9).fillColor(COLORS.text);
      pdf.text(doc.payment_terms, 40, pdf.y, { width: 515 });
      pdf.moveDown(1);
    }

    if (doc.terms) {
      pdf.fillColor(COLORS.navy).font("Helvetica-Bold").fontSize(10);
      pdf.text("TERMOS E CONDIÇÕES", 40, pdf.y);
      pdf.moveDown(0.3);
      pdf.font("Helvetica").fontSize(9).fillColor(COLORS.text);
      pdf.text(doc.terms, 40, pdf.y, { width: 515 });
      pdf.moveDown(1);
    }

    // ========== ASSINATURAS (só contrato) ==========
    if (isContract) {
      pdf.moveDown(2);
      const sigTop = pdf.y;
      if (sigTop > 720) { pdf.addPage(); pdf.y = 60; }

      pdf.fillColor(COLORS.text).font("Helvetica").fontSize(9);
      pdf.text("_______________________________________________", 40, pdf.y);
      pdf.moveDown(0.3);
      pdf.font("Helvetica-Bold");
      pdf.text(doc.client_name ?? "CONTRATANTE", 40, pdf.y);
      pdf.font("Helvetica").fontSize(8).fillColor(COLORS.gray);
      pdf.text("CONTRATANTE", 40, pdf.y);
      pdf.moveDown(2);

      pdf.fillColor(COLORS.text).font("Helvetica").fontSize(9);
      pdf.text("_______________________________________________", 40, pdf.y);
      pdf.moveDown(0.3);
      pdf.font("Helvetica-Bold");
      pdf.text(tenantName, 40, pdf.y);
      pdf.font("Helvetica").fontSize(8).fillColor(COLORS.gray);
      pdf.text("CONTRATADA", 40, pdf.y);
    }

    // ========== FOOTER ==========
    const totalPages = pdf.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      pdf.switchToPage(i);
      pdf.fillColor(COLORS.gray).font("Helvetica").fontSize(8);
      pdf.text(
        `${tenantName} · ${docLabel} #${String(doc.number).padStart(4, "0")} · Página ${i + 1} de ${totalPages}`,
        40, 800, { width: 515, align: "center" },
      );
    }

    pdf.end();
  });
}
