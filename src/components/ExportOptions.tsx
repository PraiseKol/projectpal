import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileDown, Copy, FileText, FileType, Eye, Check } from "lucide-react";
import { toast } from "sonner";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import jsPDF from "jspdf";

interface ExportOptionsProps {
  content: string;
  onOpenViewer?: () => void;
}

export function ExportOptions({ content, onOpenViewer }: ExportOptionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownloadDocx = async () => {
    try {
      // Parse markdown-like content into paragraphs
      const lines = content.split("\n");
      const children: Paragraph[] = [];

      lines.forEach((line) => {
        if (line.startsWith("# ")) {
          children.push(
            new Paragraph({
              text: line.replace("# ", ""),
              heading: HeadingLevel.HEADING_1,
            })
          );
        } else if (line.startsWith("## ")) {
          children.push(
            new Paragraph({
              text: line.replace("## ", ""),
              heading: HeadingLevel.HEADING_2,
            })
          );
        } else if (line.startsWith("### ")) {
          children.push(
            new Paragraph({
              text: line.replace("### ", ""),
              heading: HeadingLevel.HEADING_3,
            })
          );
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
          children.push(
            new Paragraph({
              text: line.replace(/^[-*] /, ""),
              bullet: { level: 0 },
            })
          );
        } else if (line.match(/^\d+\. /)) {
          children.push(
            new Paragraph({
              text: line.replace(/^\d+\. /, ""),
              numbering: { reference: "default", level: 0 },
            })
          );
        } else if (line.trim()) {
          // Handle bold and italic
          const runs: TextRun[] = [];
          let remaining = line;
          
          // Simple parsing for **bold** and *italic*
          const boldRegex = /\*\*(.+?)\*\*/g;
          const italicRegex = /\*(.+?)\*/g;
          
          // For simplicity, just add as plain text
          runs.push(new TextRun({ text: remaining }));
          
          children.push(new Paragraph({ children: runs }));
        } else {
          children.push(new Paragraph({ text: "" }));
        }
      });

      const doc = new Document({
        sections: [{ children }],
        numbering: {
          config: [
            {
              reference: "default",
              levels: [
                {
                  level: 0,
                  format: "decimal",
                  text: "%1.",
                  alignment: "left" as const,
                },
              ],
            },
          ],
        },
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `document-${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded as .docx");
    } catch (error) {
      console.error("DOCX generation error:", error);
      toast.error("Failed to generate Word document");
    }
  };

  const handleDownloadPdf = () => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      
      // Split content into lines and handle wrapping
      const lines = content.split("\n");
      let y = margin;
      
      lines.forEach((line) => {
        // Handle headings
        if (line.startsWith("# ")) {
          pdf.setFontSize(18);
          pdf.setFont("helvetica", "bold");
          line = line.replace("# ", "");
        } else if (line.startsWith("## ")) {
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          line = line.replace("## ", "");
        } else if (line.startsWith("### ")) {
          pdf.setFontSize(12);
          pdf.setFont("helvetica", "bold");
          line = line.replace("### ", "");
        } else {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "normal");
        }

        // Handle bullet points
        if (line.startsWith("- ") || line.startsWith("* ")) {
          line = "• " + line.replace(/^[-*] /, "");
        }

        // Wrap text
        const splitLines = pdf.splitTextToSize(line, maxWidth);
        
        splitLines.forEach((textLine: string) => {
          if (y > pdf.internal.pageSize.getHeight() - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(textLine, margin, y);
          y += 6;
        });
        
        y += 2; // Line spacing
      });

      pdf.save(`document-${Date.now()}.pdf`);
      toast.success("Downloaded as .pdf");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <FileDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          Copy to Clipboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadDocx}>
          <FileText className="h-4 w-4 mr-2" />
          Download as .docx
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadPdf}>
          <FileType className="h-4 w-4 mr-2" />
          Download as .pdf
        </DropdownMenuItem>
        {onOpenViewer && (
          <DropdownMenuItem onClick={onOpenViewer}>
            <Eye className="h-4 w-4 mr-2" />
            Open in Viewer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
