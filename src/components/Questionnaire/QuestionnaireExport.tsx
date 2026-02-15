import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from "docx";
import { QuestionnaireData, getScaleLabels } from "./types";

export async function exportToPdf(data: QuestionnaireData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.title, pageWidth / 2, y, { align: "center" });
  y += 8;

  if (data.subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(data.subtitle, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  if (data.labels?.length) {
    doc.setFontSize(9);
    doc.text(data.labels.join("  |  "), pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  if (data.introText) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    const lines = doc.splitTextToSize(data.introText, contentWidth);
    checkPage(lines.length * 5);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  let globalQ = 0;

  for (const section of data.sections) {
    checkPage(20);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(section.title || "Untitled Section", margin, y);
    y += 6;

    if (section.description) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      const lines = doc.splitTextToSize(section.description, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 3;
    }

    for (const q of section.questions) {
      globalQ++;
      checkPage(25);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      const qText = `${globalQ}. ${q.text || "(No question text)"}`;
      const qLines = doc.splitTextToSize(qText, contentWidth);
      doc.text(qLines, margin, y);
      y += qLines.length * 5;

      if (q.helperText) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text(q.helperText, margin + 5, y);
        y += 4;
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      if (q.type === "yes_no") {
        doc.circle(margin + 7, y - 1, 2);
        doc.text("Yes", margin + 11, y);
        doc.circle(margin + 27, y - 1, 2);
        doc.text("No", margin + 31, y);
        y += 6;
      } else if (q.type === "short_text") {
        doc.setDrawColor(180);
        doc.line(margin + 5, y + 2, margin + 120, y + 2);
        y += 8;
      } else if (q.type === "long_text") {
        doc.setDrawColor(180);
        doc.rect(margin + 5, y, 130, 18);
        y += 22;
      } else if (q.type === "rating_scale") {
        const labels = getScaleLabels(q.scaleDirection || "1to5");
        const cellW = 22;
        const startX = margin + 5;
        checkPage(20);

        // Header row
        labels.forEach(({ value, label }, i) => {
          const x = startX + i * cellW;
          doc.rect(x, y, cellW, 8);
          doc.setFont("helvetica", "bold");
          doc.text(String(value), x + cellW / 2, y + 4, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text(label, x + cellW / 2, y + 7, { align: "center" });
          doc.setFontSize(9);
        });
        y += 8;

        // Selection row
        labels.forEach((_, i) => {
          const x = startX + i * cellW;
          doc.rect(x, y, cellW, 7);
          doc.circle(x + cellW / 2, y + 3.5, 2);
        });
        y += 11;
      } else if (q.type === "multiple_choice") {
        const options = q.options || [];
        for (const opt of options) {
          checkPage(6);
          doc.circle(margin + 7, y - 1, 2);
          doc.text(opt || "(empty option)", margin + 11, y);
          y += 5;
        }
        y += 2;
      }

      y += 2;
    }
    y += 4;
  }

  doc.save(`${data.title || "questionnaire"}.pdf`);
}

export async function exportToDocx(data: QuestionnaireData) {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: data.title, bold: true, size: 36 })],
  }));

  if (data.subtitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: data.subtitle, size: 22, color: "666666" })],
    }));
  }

  if (data.labels?.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: data.labels.join("  |  "), size: 18, italics: true })],
    }));
  }

  if (data.introText) {
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: data.introText, size: 20, italics: true })],
    }));
  }

  let globalQ = 0;

  for (const section of data.sections) {
    children.push(new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: section.title || "Untitled Section", bold: true, size: 26 })],
    }));

    if (section.description) {
      children.push(new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: section.description, size: 18, italics: true, color: "666666" })],
      }));
    }

    for (const q of section.questions) {
      globalQ++;

      children.push(new Paragraph({
        spacing: { before: 150, after: 50 },
        children: [
          new TextRun({ text: `${globalQ}. `, bold: true, size: 20 }),
          new TextRun({ text: q.text || "(No question text)", bold: true, size: 20 }),
        ],
      }));

      if (q.helperText) {
        children.push(new Paragraph({
          spacing: { after: 50 },
          indent: { left: 400 },
          children: [new TextRun({ text: q.helperText, size: 16, italics: true, color: "888888" })],
        }));
      }

      if (q.type === "yes_no") {
        children.push(new Paragraph({
          indent: { left: 400 },
          spacing: { after: 100 },
          children: [
            new TextRun({ text: "○  Yes          ○  No", size: 20 }),
          ],
        }));
      } else if (q.type === "short_text") {
        children.push(new Paragraph({
          indent: { left: 400 },
          spacing: { after: 100 },
          children: [new TextRun({ text: "_______________________________________________", size: 20, color: "AAAAAA" })],
        }));
      } else if (q.type === "long_text") {
        for (let i = 0; i < 3; i++) {
          children.push(new Paragraph({
            indent: { left: 400 },
            children: [new TextRun({ text: "_______________________________________________", size: 20, color: "AAAAAA" })],
          }));
        }
        children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      } else if (q.type === "rating_scale") {
        const labels = getScaleLabels(q.scaleDirection || "1to5");
        const borderOpts = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
        const borders = { top: borderOpts, bottom: borderOpts, left: borderOpts, right: borderOpts };

        const headerRow = new TableRow({
          children: labels.map(({ value, label }) =>
            new TableCell({
              borders,
              width: { size: 1800, type: WidthType.DXA },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${value}`, bold: true, size: 18 }),
                  new TextRun({ text: `\n${label}`, size: 14, color: "666666", break: 1 }),
                ],
              })],
            })
          ),
        });

        const valueRow = new TableRow({
          children: labels.map(() =>
            new TableCell({
              borders,
              width: { size: 1800, type: WidthType.DXA },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: "○", size: 20 })],
              })],
            })
          ),
        });

        children.push(new Table({
          indent: { size: 400, type: WidthType.DXA },
          rows: [headerRow, valueRow],
        }));

        children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      } else if (q.type === "multiple_choice") {
        for (const opt of (q.options || [])) {
          children.push(new Paragraph({
            indent: { left: 400 },
            spacing: { after: 40 },
            children: [new TextRun({ text: `○  ${opt || "(empty option)"}`, size: 20 })],
          }));
        }
        children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.title || "questionnaire"}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
