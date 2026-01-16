import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  type: "pptx" | "docx" | "pdf";
}

export function DocumentViewer({ isOpen, onClose, url, title, type }: DocumentViewerProps) {
  // Microsoft Office Online Viewer for PPTX and DOCX
  const getViewerUrl = () => {
    if (type === "pdf") {
      return url; // Embed directly
    }
    // Use Office Online Viewer for Office documents
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <DialogTitle className="text-lg">{title || "Document Viewer"}</DialogTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 h-full min-h-0">
          {type === "pdf" ? (
            <embed
              src={url}
              type="application/pdf"
              className="w-full h-full"
              style={{ minHeight: "calc(85vh - 80px)" }}
            />
          ) : (
            <iframe
              src={getViewerUrl()}
              className="w-full h-full border-0"
              style={{ minHeight: "calc(85vh - 80px)" }}
              title={title || "Document Preview"}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
