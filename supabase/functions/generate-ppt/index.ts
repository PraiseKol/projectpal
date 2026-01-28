import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PptxGenJS from "https://esm.sh/pptxgenjs@3.12.0";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_CREDIT_COST = 15;
const IMAGE_CREDIT_COST = 5;

// Avoid call-stack overflow when converting large binary buffers
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000; // 32KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function stripXmlToText(xml: string): string {
  const withSpaces = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n");

  return withSpaces
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractDocxText(arrayBuffer: ArrayBuffer): string {
  const zipped = new Uint8Array(arrayBuffer);
  const files = unzipSync(zipped);
  const docXml = files["word/document.xml"];
  if (!docXml) throw new Error("DOCX missing word/document.xml");
  const xmlText = new TextDecoder().decode(docXml);
  return stripXmlToText(xmlText);
}

function stripMarkdownCodeFences(input: string): string {
  const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? input).trim();
}

function extractJsonCandidate(input: string): string | null {
  const text = stripMarkdownCodeFences(input);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1).trim();
}

function safeJsonParse<T>(raw: string): T {
  // Common model-output issues: control chars, trailing commas.
  const cleaned = raw
    .replace(/\uFEFF/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(cleaned) as T;
}

function sanitizeSlideText(input: string): string {
  // Prevent JSON/markdown leakage into slides.
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^[\s>]*`{0,3}json\s*$/gim, "")
    .replace(/^[\s>]*[{}\[\]]\s*$/gim, "")
    .replace(/^[\s>]*["'{]{1,2}\s*/gim, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toBullets(text: string, max = 6): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  // Prefer slightly longer, informative sentences.
  return sentences
    .filter(s => s.length >= 40)
    .slice(0, max)
    .map(sanitizeSlideText);
}

function buildFallbackFromDocContent(docContent: string, documentTitle: string): PresentationData {
  const findSection = (labels: string[]) => {
    const lower = docContent.toLowerCase();
    for (const label of labels) {
      const idx = lower.indexOf(label);
      if (idx !== -1) {
        // take a window after the heading
        return docContent.slice(idx, Math.min(docContent.length, idx + 2200));
      }
    }
    return "";
  };

  const abstract = findSection(["abstract", "summary"]);
  const introduction = findSection(["introduction", "background"]);
  const objectives = findSection(["objective", "objectives", "aim", "purpose"]);
  const methodology = findSection(["methodology", "method", "materials and methods"]);
  const results = findSection(["results", "findings", "discussion"]);
  const conclusion = findSection(["conclusion"]);
  const recommendations = findSection(["recommendation", "future work"]);

  const slides: SlideData[] = [
    { type: "title", title: documentTitle || "Presentation", subtitle: "AI Generated" },
  ];

  const pushIf = (title: string, body: string) => {
    const bullets = toBullets(body, 6);
    if (bullets.length) slides.push({ type: "content", title, bullets });
  };

  pushIf("Overview", abstract || docContent.slice(0, 1800));
  pushIf("Introduction", introduction);
  pushIf("Problem & Objectives", objectives);
  pushIf("Methodology", methodology);
  pushIf("Results / Findings", results);
  pushIf("Conclusion", conclusion);
  pushIf("Recommendations", recommendations);

  // Ensure we don't end up with tiny decks.
  if (slides.length < 6) {
    const mid = docContent.slice(1800, 3600);
    pushIf("Key Concepts", mid);
  }

  slides.push({ type: "thankyou", title: "Thank You" });

  return {
    title: documentTitle || "Generated Presentation",
    slides,
  };
}

// Design system for template variations
interface DesignConfig {
  style: "classic" | "modern" | "minimal" | "bold" | "elegant" | "creative";
  headerStyle: "top-bar" | "left-sidebar" | "corner-accent" | "full-banner" | "underline" | "gradient-bar" | "none";
  headerHeight: number;
  bulletStyle: "circle" | "square" | "dash" | "arrow" | "check" | "diamond" | "number";
  accentPosition: "top" | "bottom" | "left" | "corner" | "dual" | "none";
  titleAlign: "left" | "center";
  contentAlign: "left" | "center";
  decorativeElements: "minimal" | "moderate" | "bold";
  fontPrimary: string;
  fontSecondary: string;
}

// Extended theme with design configuration
interface Theme {
  name: string;
  primary: string;
  secondary: string;
  background: string;
  headerBg: string;
  text: string;
  accent: string;
  bulletColor: string;
  design: DesignConfig;
}

// 21 unique templates with varying designs
const THEMES: Theme[] = [
  // ============== CLASSIC/ACADEMIC TEMPLATES ==============
  {
    name: "Academic Blue",
    primary: "1A365D",
    secondary: "F5A962",
    background: "0F172A",
    headerBg: "1E3A5F",
    text: "FFFFFF",
    accent: "F97316",
    bulletColor: "F5A962",
    design: {
      style: "classic",
      headerStyle: "top-bar",
      headerHeight: 1.0,
      bulletStyle: "circle",
      accentPosition: "top",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "moderate",
      fontPrimary: "Arial",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Professional Teal",
    primary: "0D9488",
    secondary: "14B8A6",
    background: "042F2E",
    headerBg: "115E59",
    text: "FFFFFF",
    accent: "2DD4BF",
    bulletColor: "5EEAD4",
    design: {
      style: "modern",
      headerStyle: "gradient-bar",
      headerHeight: 0.8,
      bulletStyle: "arrow",
      accentPosition: "dual",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "bold",
      fontPrimary: "Calibri",
      fontSecondary: "Calibri"
    }
  },
  {
    name: "Classic Red-Orange",
    primary: "DC2626",
    secondary: "F97316",
    background: "7F1D1D",
    headerBg: "991B1B",
    text: "FFFFFF",
    accent: "FCD34D",
    bulletColor: "FBBF24",
    design: {
      style: "bold",
      headerStyle: "full-banner",
      headerHeight: 1.2,
      bulletStyle: "square",
      accentPosition: "bottom",
      titleAlign: "center",
      contentAlign: "left",
      decorativeElements: "bold",
      fontPrimary: "Arial",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Warm Gradient",
    primary: "92400E",
    secondary: "F59E0B",
    background: "FFFBEB",
    headerBg: "F59E0B",
    text: "1F2937",
    accent: "7C3AED",
    bulletColor: "D97706",
    design: {
      style: "elegant",
      headerStyle: "underline",
      headerHeight: 0.6,
      bulletStyle: "diamond",
      accentPosition: "top",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "minimal",
      fontPrimary: "Georgia",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Formal Green",
    primary: "166534",
    secondary: "F59E0B",
    background: "F0FDF4",
    headerBg: "166534",
    text: "1F2937",
    accent: "15803D",
    bulletColor: "166534",
    design: {
      style: "classic",
      headerStyle: "left-sidebar",
      headerHeight: 1.0,
      bulletStyle: "check",
      accentPosition: "left",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "moderate",
      fontPrimary: "Times New Roman",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Modern Purple",
    primary: "7C3AED",
    secondary: "A78BFA",
    background: "1E1B4B",
    headerBg: "4C1D95",
    text: "FFFFFF",
    accent: "C4B5FD",
    bulletColor: "A78BFA",
    design: {
      style: "modern",
      headerStyle: "corner-accent",
      headerHeight: 0.8,
      bulletStyle: "dash",
      accentPosition: "corner",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "bold",
      fontPrimary: "Calibri",
      fontSecondary: "Calibri"
    }
  },

  // ============== DARK/PROFESSIONAL TEMPLATES ==============
  {
    name: "Midnight Navy",
    primary: "0F172A",
    secondary: "FBBF24",
    background: "020617",
    headerBg: "1E3A8A",
    text: "FFFFFF",
    accent: "FCD34D",
    bulletColor: "FBBF24",
    design: {
      style: "elegant",
      headerStyle: "top-bar",
      headerHeight: 0.9,
      bulletStyle: "diamond",
      accentPosition: "dual",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "moderate",
      fontPrimary: "Georgia",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Slate Charcoal",
    primary: "334155",
    secondary: "22D3EE",
    background: "1E293B",
    headerBg: "475569",
    text: "FFFFFF",
    accent: "06B6D4",
    bulletColor: "67E8F9",
    design: {
      style: "modern",
      headerStyle: "gradient-bar",
      headerHeight: 0.7,
      bulletStyle: "arrow",
      accentPosition: "bottom",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "minimal",
      fontPrimary: "Calibri",
      fontSecondary: "Calibri"
    }
  },
  {
    name: "Deep Crimson",
    primary: "881337",
    secondary: "FB7185",
    background: "1C1917",
    headerBg: "9F1239",
    text: "FFFFFF",
    accent: "FDA4AF",
    bulletColor: "FB7185",
    design: {
      style: "bold",
      headerStyle: "full-banner",
      headerHeight: 1.3,
      bulletStyle: "square",
      accentPosition: "top",
      titleAlign: "center",
      contentAlign: "left",
      decorativeElements: "bold",
      fontPrimary: "Arial Black",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Forest Night",
    primary: "14532D",
    secondary: "84CC16",
    background: "052E16",
    headerBg: "166534",
    text: "FFFFFF",
    accent: "A3E635",
    bulletColor: "BEF264",
    design: {
      style: "classic",
      headerStyle: "left-sidebar",
      headerHeight: 1.0,
      bulletStyle: "circle",
      accentPosition: "left",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "moderate",
      fontPrimary: "Arial",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Royal Indigo",
    primary: "3730A3",
    secondary: "A78BFA",
    background: "1E1B4B",
    headerBg: "4338CA",
    text: "FFFFFF",
    accent: "C4B5FD",
    bulletColor: "A78BFA",
    design: {
      style: "elegant",
      headerStyle: "corner-accent",
      headerHeight: 0.8,
      bulletStyle: "diamond",
      accentPosition: "corner",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "bold",
      fontPrimary: "Georgia",
      fontSecondary: "Calibri"
    }
  },

  // ============== LIGHT/CLEAN TEMPLATES ==============
  {
    name: "Clean White",
    primary: "0369A1",
    secondary: "0EA5E9",
    background: "FFFFFF",
    headerBg: "0284C7",
    text: "1F2937",
    accent: "38BDF8",
    bulletColor: "0369A1",
    design: {
      style: "minimal",
      headerStyle: "underline",
      headerHeight: 0.5,
      bulletStyle: "dash",
      accentPosition: "none",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "minimal",
      fontPrimary: "Calibri Light",
      fontSecondary: "Calibri"
    }
  },
  {
    name: "Soft Lavender",
    primary: "7C3AED",
    secondary: "A78BFA",
    background: "F5F3FF",
    headerBg: "8B5CF6",
    text: "1F2937",
    accent: "C4B5FD",
    bulletColor: "7C3AED",
    design: {
      style: "elegant",
      headerStyle: "top-bar",
      headerHeight: 0.7,
      bulletStyle: "circle",
      accentPosition: "top",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "minimal",
      fontPrimary: "Georgia",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Mint Fresh",
    primary: "059669",
    secondary: "34D399",
    background: "ECFDF5",
    headerBg: "10B981",
    text: "1F2937",
    accent: "6EE7B7",
    bulletColor: "059669",
    design: {
      style: "modern",
      headerStyle: "gradient-bar",
      headerHeight: 0.6,
      bulletStyle: "check",
      accentPosition: "dual",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "moderate",
      fontPrimary: "Calibri",
      fontSecondary: "Calibri"
    }
  },
  {
    name: "Warm Sand",
    primary: "B45309",
    secondary: "F59E0B",
    background: "FFFBEB",
    headerBg: "D97706",
    text: "1F2937",
    accent: "FBBF24",
    bulletColor: "B45309",
    design: {
      style: "classic",
      headerStyle: "left-sidebar",
      headerHeight: 0.8,
      bulletStyle: "arrow",
      accentPosition: "left",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "moderate",
      fontPrimary: "Times New Roman",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Sky Blue",
    primary: "0284C7",
    secondary: "38BDF8",
    background: "F0F9FF",
    headerBg: "0369A1",
    text: "1F2937",
    accent: "7DD3FC",
    bulletColor: "0284C7",
    design: {
      style: "minimal",
      headerStyle: "none",
      headerHeight: 0,
      bulletStyle: "dash",
      accentPosition: "bottom",
      titleAlign: "center",
      contentAlign: "left",
      decorativeElements: "minimal",
      fontPrimary: "Calibri",
      fontSecondary: "Calibri"
    }
  },

  // ============== SPECIALTY/CREATIVE TEMPLATES ==============
  {
    name: "Sunset Orange",
    primary: "EA580C",
    secondary: "FB923C",
    background: "431407",
    headerBg: "C2410C",
    text: "FFFFFF",
    accent: "FDBA74",
    bulletColor: "FB923C",
    design: {
      style: "creative",
      headerStyle: "full-banner",
      headerHeight: 1.4,
      bulletStyle: "arrow",
      accentPosition: "dual",
      titleAlign: "center",
      contentAlign: "left",
      decorativeElements: "bold",
      fontPrimary: "Arial",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Ocean Deep",
    primary: "0E7490",
    secondary: "22D3EE",
    background: "083344",
    headerBg: "0891B2",
    text: "FFFFFF",
    accent: "67E8F9",
    bulletColor: "22D3EE",
    design: {
      style: "modern",
      headerStyle: "gradient-bar",
      headerHeight: 0.9,
      bulletStyle: "circle",
      accentPosition: "bottom",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "moderate",
      fontPrimary: "Calibri",
      fontSecondary: "Calibri"
    }
  },
  {
    name: "Rose Gold",
    primary: "BE185D",
    secondary: "F472B6",
    background: "FDF2F8",
    headerBg: "DB2777",
    text: "1F2937",
    accent: "F9A8D4",
    bulletColor: "BE185D",
    design: {
      style: "elegant",
      headerStyle: "corner-accent",
      headerHeight: 0.7,
      bulletStyle: "diamond",
      accentPosition: "corner",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "moderate",
      fontPrimary: "Georgia",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Electric Blue",
    primary: "2563EB",
    secondary: "60A5FA",
    background: "172554",
    headerBg: "1D4ED8",
    text: "FFFFFF",
    accent: "93C5FD",
    bulletColor: "60A5FA",
    design: {
      style: "bold",
      headerStyle: "top-bar",
      headerHeight: 1.1,
      bulletStyle: "square",
      accentPosition: "top",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "bold",
      fontPrimary: "Arial Black",
      fontSecondary: "Arial"
    }
  },
  {
    name: "Emerald Prestige",
    primary: "047857",
    secondary: "FBBF24",
    background: "022C22",
    headerBg: "059669",
    text: "FFFFFF",
    accent: "FCD34D",
    bulletColor: "FBBF24",
    design: {
      style: "elegant",
      headerStyle: "left-sidebar",
      headerHeight: 1.0,
      bulletStyle: "diamond",
      accentPosition: "left",
      titleAlign: "left",
      contentAlign: "left",
      decorativeElements: "bold",
      fontPrimary: "Georgia",
      fontSecondary: "Calibri"
    }
  }
];

interface SlideData {
  type: "title" | "content" | "section" | "table" | "conclusion" | "references" | "thankyou";
  title: string;
  subtitle?: string;
  bullets?: string[];
  imagePrompt?: string;
  tableData?: { headers: string[]; rows: string[][] };
}

interface PresentationData {
  title: string;
  author?: string;
  institution?: string;
  slides: SlideData[];
}

// Get bullet character based on style
function getBulletChar(style: string, index: number): string {
  const bulletMap: Record<string, string | ((i: number) => string)> = {
    "circle": "•",
    "square": "■",
    "dash": "—",
    "arrow": "→",
    "check": "✓",
    "diamond": "◆",
    "number": (i: number) => `${i + 1}.`
  };
  const bullet = bulletMap[style] || "•";
  return typeof bullet === 'function' ? bullet(index) : bullet;
}

// Helper function to fetch image and convert to base64 data URI
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    console.log('[IMAGE] Fetching image for base64 conversion:', imageUrl.substring(0, 60));
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error('[IMAGE] Failed to fetch image:', response.status);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = uint8ToBase64(new Uint8Array(arrayBuffer));
    const contentType = response.headers.get('content-type') || 'image/png';
    
    console.log('[IMAGE] Successfully converted to base64');
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.error('[IMAGE] Base64 conversion error:', e);
    return null;
  }
}

// Generate AI image for slides - now returns base64 data directly
async function generateSlideImage(
  prompt: string, 
  theme: Theme, 
  apiKey: string,
  supabaseClient: any,
  userId: string
): Promise<string | null> {
  try {
    console.log('[IMAGE] Generating image for prompt:', prompt.substring(0, 50));
    
    const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{
          role: 'user',
          content: `Create a professional, clean illustration for a presentation slide about: ${prompt}. 
Style: Modern, minimalist, professional, suitable for academic presentations.
Color scheme: Use shades of #${theme.primary} and #${theme.secondary}.
No text in the image. High quality, clean vector-style illustration. Simple and elegant.`
        }],
        modalities: ['image', 'text']
      }),
    });

    if (!imageResponse.ok) {
      console.error('[IMAGE] Generation failed:', imageResponse.status);
      return null;
    }

    const imageData = await imageResponse.json();
    const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (base64Image && base64Image.includes('base64,')) {
      // Return the base64 data directly instead of uploading to storage
      console.log('[IMAGE] Generated successfully, returning base64 data');
      return base64Image;
    }
  } catch (e) {
    console.error('[IMAGE] Generation error:', e);
  }
  return null;
}

// ============== DESIGN-AWARE SLIDE BUILDERS ==============

// Build title slide with design variations
function buildTitleSlide(pptx: PptxGenJS, data: SlideData, theme: Theme, presentationData: PresentationData) {
  const slide = pptx.addSlide();
  const { design } = theme;
  slide.background = { color: theme.background };
  
  // Apply header based on design style
  switch (design.headerStyle) {
    case "top-bar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: design.headerHeight, 
        fill: { color: theme.primary } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: design.headerHeight, w: '100%', h: 0.05, 
        fill: { color: theme.secondary } 
      });
      break;
      
    case "left-sidebar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: 1.2, h: '100%', 
        fill: { color: theme.primary } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 1.2, y: 0, w: 0.05, h: '100%', 
        fill: { color: theme.secondary } 
      });
      break;
      
    case "corner-accent":
      // Top-left triangle accent
      slide.addShape(pptx.ShapeType.rtTriangle, { 
        x: 0, y: 0, w: 2.5, h: 2.5, 
        fill: { color: theme.primary },
        rotate: 0
      });
      // Bottom-right accent
      slide.addShape(pptx.ShapeType.rect, { 
        x: 8, y: 4.8, w: 2, h: 0.7, 
        fill: { color: theme.secondary } 
      });
      break;
      
    case "full-banner":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: design.headerHeight, 
        fill: { color: theme.primary } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: design.headerHeight - 0.15, w: '100%', h: 0.15, 
        fill: { color: theme.secondary } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 5.5 - 0.3, w: '100%', h: 0.3, 
        fill: { color: theme.headerBg } 
      });
      break;
      
    case "gradient-bar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: design.headerHeight, 
        fill: { color: theme.primary } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: design.headerHeight, w: 5, h: 0.08, 
        fill: { color: theme.secondary } 
      });
      break;
      
    case "underline":
      // Minimal - just decorative line
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0.5, y: 3.4, w: 2, h: 0.05, 
        fill: { color: theme.primary } 
      });
      break;
      
    case "none":
    default:
      // No header decoration
      break;
  }
  
  // Title positioning based on design
  const titleX = design.headerStyle === "left-sidebar" ? 1.5 : 0.5;
  const titleW = design.headerStyle === "left-sidebar" ? 8 : 9;
  const titleY = design.style === "bold" ? 1.8 : 2.2;
  
  slide.addText(data.title || presentationData.title, {
    x: titleX, y: titleY, w: titleW, h: 1.2,
    fontSize: design.style === "bold" ? 44 : 40, 
    bold: true, 
    color: theme.text, 
    align: design.titleAlign,
    fontFace: design.fontPrimary
  });
  
  // Subtitle/Author
  const subtitle = data.subtitle || presentationData.author || '';
  if (subtitle) {
    slide.addText(subtitle, {
      x: titleX, y: titleY + 1.3, w: titleW, h: 0.6,
      fontSize: 20, color: theme.accent, align: design.titleAlign,
      fontFace: design.fontSecondary
    });
  }
  
  // Institution
  if (presentationData.institution) {
    slide.addText(presentationData.institution, {
      x: titleX, y: titleY + 2.0, w: titleW, h: 0.5,
      fontSize: 16, color: theme.secondary, align: design.titleAlign,
      fontFace: design.fontSecondary
    });
  }
  
  // Bottom decorative element based on accent position
  if (design.accentPosition === "bottom" || design.accentPosition === "dual") {
    slide.addShape(pptx.ShapeType.rect, { 
      x: design.titleAlign === "center" ? 3.5 : titleX, 
      y: 4.9, 
      w: design.titleAlign === "center" ? 3 : 2.5, 
      h: 0.04, 
      fill: { color: theme.secondary } 
    });
  }
}

// Build content slide with design variations
function buildContentSlide(pptx: PptxGenJS, data: SlideData, theme: Theme, imageUrl?: string) {
  const slide = pptx.addSlide();
  const { design } = theme;
  slide.background = { color: theme.background };
  
  let contentStartX = 0.5;
  let contentStartY = 1.3;
  let contentWidth = imageUrl ? 5.5 : 9;
  
  // Apply header based on design style
  switch (design.headerStyle) {
    case "top-bar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: design.headerHeight, 
        fill: { color: theme.headerBg } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: design.headerHeight, w: '100%', h: 0.03, 
        fill: { color: theme.secondary } 
      });
      slide.addText(data.title, {
        x: 0.4, y: (design.headerHeight - 0.6) / 2, w: 9.2, h: 0.6,
        fontSize: 26, bold: true, color: 'FFFFFF',
        fontFace: design.fontPrimary
      });
      contentStartY = design.headerHeight + 0.3;
      break;
      
    case "left-sidebar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: 0.4, h: '100%', 
        fill: { color: theme.primary } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0.4, y: 0, w: 0.03, h: '100%', 
        fill: { color: theme.secondary } 
      });
      slide.addText(data.title, {
        x: 0.6, y: 0.3, w: 9, h: 0.7,
        fontSize: 26, bold: true, color: theme.text,
        fontFace: design.fontPrimary
      });
      contentStartX = 0.6;
      contentStartY = 1.2;
      break;
      
    case "corner-accent":
      slide.addShape(pptx.ShapeType.rtTriangle, { 
        x: 0, y: 0, w: 1.2, h: 1.2, 
        fill: { color: theme.primary },
        rotate: 0
      });
      slide.addText(data.title, {
        x: 0.5, y: 0.3, w: 9, h: 0.7,
        fontSize: 26, bold: true, color: theme.text,
        fontFace: design.fontPrimary
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0.5, y: 1.0, w: 3, h: 0.04, 
        fill: { color: theme.secondary } 
      });
      contentStartY = 1.3;
      break;
      
    case "full-banner":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: design.headerHeight, 
        fill: { color: theme.headerBg } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: design.headerHeight - 0.1, w: '100%', h: 0.1, 
        fill: { color: theme.secondary } 
      });
      slide.addText(data.title, {
        x: 0.5, y: (design.headerHeight - 0.7) / 2, w: 9, h: 0.7,
        fontSize: 28, bold: true, color: 'FFFFFF',
        align: design.titleAlign,
        fontFace: design.fontPrimary
      });
      contentStartY = design.headerHeight + 0.3;
      break;
      
    case "gradient-bar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: design.headerHeight, 
        fill: { color: theme.headerBg } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: design.headerHeight, w: 4, h: 0.06, 
        fill: { color: theme.secondary } 
      });
      slide.addText(data.title, {
        x: 0.4, y: (design.headerHeight - 0.5) / 2, w: 9.2, h: 0.5,
        fontSize: 24, bold: true, color: 'FFFFFF',
        fontFace: design.fontPrimary
      });
      contentStartY = design.headerHeight + 0.25;
      break;
      
    case "underline":
      slide.addText(data.title, {
        x: 0.5, y: 0.3, w: 9, h: 0.7,
        fontSize: 26, bold: true, color: theme.primary,
        fontFace: design.fontPrimary
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0.5, y: 1.0, w: 2.5, h: 0.04, 
        fill: { color: theme.secondary } 
      });
      contentStartY = 1.3;
      break;
      
    case "none":
    default:
      slide.addText(data.title, {
        x: 0.5, y: 0.4, w: 9, h: 0.7,
        fontSize: 28, bold: true, color: theme.primary,
        align: design.titleAlign,
        fontFace: design.fontPrimary
      });
      contentStartY = 1.3;
      break;
  }
  
  // Content bullets
  const bullets = data.bullets || [];
  const lineHeight = design.style === "bold" ? 0.7 : 0.65;
  
  bullets.forEach((bullet, i) => {
    if (i < 7) {
      const bulletChar = getBulletChar(design.bulletStyle, i);
      slide.addText(`${bulletChar} ${bullet}`, {
        x: contentStartX, 
        y: contentStartY + (i * lineHeight), 
        w: contentWidth, 
        h: 0.6,
        fontSize: design.style === "minimal" ? 14 : 15, 
        color: theme.text,
        fontFace: design.fontSecondary,
        valign: 'top'
      });
    }
  });
  
  // Add bottom accent for certain designs
  if (design.accentPosition === "bottom" || design.accentPosition === "dual") {
    slide.addShape(pptx.ShapeType.rect, { 
      x: 0, y: 5.35, w: '100%', h: 0.15, 
      fill: { color: theme.secondary } 
    });
  }
  
  // Add image if available - use data property instead of path to avoid XMLHttpRequest
  if (imageUrl) {
    try {
      // If imageUrl is already base64 data, use it directly
      // Otherwise it would be a URL that we need to convert (but we now generate base64 directly)
      slide.addImage({
        data: imageUrl,
        x: 6.0, y: contentStartY, w: 3.5, h: 3.5
      });
    } catch (e) {
      console.error('Failed to add image to slide:', e);
    }
  }
}

// Build section header slide with design variations
function buildSectionSlide(pptx: PptxGenJS, data: SlideData, theme: Theme) {
  const slide = pptx.addSlide();
  const { design } = theme;
  
  // Section slides use primary color as background for most designs
  if (design.style === "minimal" || design.style === "elegant") {
    slide.background = { color: theme.background };
  } else {
    slide.background = { color: theme.primary };
  }
  
  const textColor = (design.style === "minimal" || design.style === "elegant") ? theme.primary : 'FFFFFF';
  
  // Add decorative elements based on design
  switch (design.decorativeElements) {
    case "bold":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 2.5, w: '100%', h: 0.08, 
        fill: { color: theme.secondary } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 3.2, w: '100%', h: 0.08, 
        fill: { color: theme.accent } 
      });
      break;
    case "moderate":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 3, y: 3.5, w: 4, h: 0.05, 
        fill: { color: theme.secondary } 
      });
      break;
    case "minimal":
    default:
      slide.addShape(pptx.ShapeType.rect, { 
        x: 4, y: 3.4, w: 2, h: 0.03, 
        fill: { color: theme.secondary } 
      });
      break;
  }
  
  slide.addText(data.title, {
    x: 0.5, y: 2.3, w: 9, h: 1,
    fontSize: design.style === "bold" ? 48 : 44, 
    bold: true, 
    color: textColor, 
    align: 'center',
    fontFace: design.fontPrimary
  });
  
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.5, y: 3.8, w: 9, h: 0.5,
      fontSize: 18, 
      color: (design.style === "minimal" || design.style === "elegant") ? theme.accent : theme.secondary, 
      align: 'center',
      fontFace: design.fontSecondary
    });
  }
}

// Build table slide with design variations
function buildTableSlide(pptx: PptxGenJS, data: SlideData, theme: Theme) {
  const slide = pptx.addSlide();
  const { design } = theme;
  slide.background = { color: theme.background };
  
  // Apply header based on design
  let contentStartY = 1.3;
  
  switch (design.headerStyle) {
    case "left-sidebar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: 0.4, h: '100%', 
        fill: { color: theme.primary } 
      });
      slide.addText(data.title, {
        x: 0.6, y: 0.3, w: 9, h: 0.6,
        fontSize: 26, bold: true, color: theme.text,
        fontFace: design.fontPrimary
      });
      contentStartY = 1.1;
      break;
      
    case "underline":
    case "none":
      slide.addText(data.title, {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 26, bold: true, color: theme.primary,
        fontFace: design.fontPrimary
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0.5, y: 0.9, w: 2, h: 0.03, 
        fill: { color: theme.secondary } 
      });
      contentStartY = 1.2;
      break;
      
    default:
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: design.headerHeight || 1, 
        fill: { color: theme.headerBg } 
      });
      slide.addText(data.title, {
        x: 0.4, y: 0.25, w: 9.2, h: 0.6,
        fontSize: 26, bold: true, color: 'FFFFFF',
        fontFace: design.fontPrimary
      });
      contentStartY = (design.headerHeight || 1) + 0.3;
      break;
  }
  
  if (data.tableData && data.tableData.headers && data.tableData.rows) {
    const tableRows: any[] = [];
    
    // Header row
    tableRows.push(data.tableData.headers.map(h => ({
      text: h, options: { bold: true, fill: { color: theme.primary }, color: 'FFFFFF', fontSize: 12, fontFace: design.fontPrimary }
    })));
    
    // Data rows with alternating colors
    data.tableData.rows.forEach((row, i) => {
      tableRows.push(row.map(cell => ({
        text: cell, options: { 
          fill: { color: i % 2 === 0 ? 'F3F4F6' : 'FFFFFF' }, 
          color: '374151', 
          fontSize: 11,
          fontFace: design.fontSecondary 
        }
      })));
    });
    
    slide.addTable(tableRows, {
      x: 0.5, y: contentStartY, w: 9,
      border: { pt: 0.5, color: 'E5E7EB' },
      fontFace: design.fontSecondary
    });
  }
}

// Build conclusion slide with design variations
function buildConclusionSlide(pptx: PptxGenJS, data: SlideData, theme: Theme) {
  const slide = pptx.addSlide();
  const { design } = theme;
  slide.background = { color: theme.background };
  
  // Header with different style for conclusion
  let contentStartY = 1.5;
  
  switch (design.headerStyle) {
    case "full-banner":
    case "top-bar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: 1.2, 
        fill: { color: theme.primary } 
      });
      slide.addText(data.title, {
        x: 0.4, y: 0.35, w: 9.2, h: 0.6,
        fontSize: 28, bold: true, color: 'FFFFFF',
        fontFace: design.fontPrimary
      });
      contentStartY = 1.5;
      break;
      
    case "corner-accent":
      slide.addShape(pptx.ShapeType.rtTriangle, { 
        x: 0, y: 0, w: 1.5, h: 1.5, 
        fill: { color: theme.primary },
        rotate: 0
      });
      slide.addText(data.title, {
        x: 0.5, y: 0.4, w: 9, h: 0.6,
        fontSize: 28, bold: true, color: theme.text,
        fontFace: design.fontPrimary
      });
      contentStartY = 1.3;
      break;
      
    default:
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: 1.2, 
        fill: { color: theme.headerBg } 
      });
      slide.addText(data.title, {
        x: 0.4, y: 0.35, w: 9.2, h: 0.6,
        fontSize: 28, bold: true, color: 'FFFFFF',
        fontFace: design.fontPrimary
      });
      contentStartY = 1.5;
      break;
  }
  
  const bullets = data.bullets || [];
  bullets.forEach((bullet, i) => {
    if (i < 6) {
      const bulletChar = design.bulletStyle === "check" ? "✓" : getBulletChar(design.bulletStyle, i);
      slide.addText(`${bulletChar} ${bullet}`, {
        x: 0.5, y: contentStartY + (i * 0.7), w: 9, h: 0.6,
        fontSize: 16, color: theme.text,
        fontFace: design.fontSecondary
      });
    }
  });
}

// Build references slide with design variations
function buildReferencesSlide(pptx: PptxGenJS, data: SlideData, theme: Theme) {
  const slide = pptx.addSlide();
  const { design } = theme;
  slide.background = { color: theme.background };
  
  let contentStartY = 1.3;
  
  switch (design.headerStyle) {
    case "left-sidebar":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: 0.4, h: '100%', 
        fill: { color: theme.primary } 
      });
      slide.addText("References", {
        x: 0.6, y: 0.3, w: 9, h: 0.6,
        fontSize: 26, bold: true, color: theme.text,
        fontFace: design.fontPrimary
      });
      contentStartY = 1.1;
      break;
      
    case "underline":
    case "none":
      slide.addText("References", {
        x: 0.5, y: 0.3, w: 9, h: 0.6,
        fontSize: 26, bold: true, color: theme.primary,
        fontFace: design.fontPrimary
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0.5, y: 0.9, w: 2, h: 0.03, 
        fill: { color: theme.secondary } 
      });
      break;
      
    default:
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: 1, 
        fill: { color: theme.headerBg } 
      });
      slide.addText("References", {
        x: 0.4, y: 0.25, w: 9.2, h: 0.6,
        fontSize: 26, bold: true, color: 'FFFFFF',
        fontFace: design.fontPrimary
      });
      break;
  }
  
  const refs = data.bullets || [];
  refs.forEach((ref, i) => {
    if (i < 8) {
      slide.addText(`[${i + 1}] ${ref}`, {
        x: 0.5, y: contentStartY + (i * 0.55), w: 9, h: 0.5,
        fontSize: 12, color: theme.text,
        fontFace: design.fontSecondary
      });
    }
  });
}

// Build thank you slide with design variations
function buildThankYouSlide(pptx: PptxGenJS, theme: Theme, author?: string, institution?: string) {
  const slide = pptx.addSlide();
  const { design } = theme;
  
  // Use primary color for most designs, but keep background for minimal/elegant
  if (design.style === "minimal") {
    slide.background = { color: theme.background };
  } else {
    slide.background = { color: theme.primary };
  }
  
  const textColor = design.style === "minimal" ? theme.primary : 'FFFFFF';
  
  // Add decorative elements based on design
  switch (design.decorativeElements) {
    case "bold":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 0, w: '100%', h: 0.2, 
        fill: { color: theme.secondary } 
      });
      slide.addShape(pptx.ShapeType.rect, { 
        x: 0, y: 5.3, w: '100%', h: 0.2, 
        fill: { color: theme.secondary } 
      });
      break;
    case "moderate":
      slide.addShape(pptx.ShapeType.rect, { 
        x: 3.5, y: 4, w: 3, h: 0.04, 
        fill: { color: theme.secondary } 
      });
      break;
    case "minimal":
    default:
      slide.addShape(pptx.ShapeType.rect, { 
        x: 4, y: 3.8, w: 2, h: 0.03, 
        fill: { color: theme.secondary } 
      });
      break;
  }
  
  slide.addText("Thank You!", {
    x: 0.5, y: 1.8, w: 9, h: 1.2,
    fontSize: design.style === "bold" ? 56 : 52, 
    bold: true, 
    color: textColor, 
    align: 'center',
    fontFace: design.fontPrimary
  });
  
  slide.addText("Questions & Discussion", {
    x: 0.5, y: 3.2, w: 9, h: 0.6,
    fontSize: 22, 
    color: design.style === "minimal" ? theme.accent : theme.secondary, 
    align: 'center',
    fontFace: design.fontSecondary
  });
  
  if (author) {
    slide.addText(author, {
      x: 0.5, y: 4.3, w: 9, h: 0.5,
      fontSize: 16, color: textColor, align: 'center',
      fontFace: design.fontSecondary
    });
  }
  
  if (institution) {
    slide.addText(institution, {
      x: 0.5, y: 4.8, w: 9, h: 0.4,
      fontSize: 14, 
      color: design.style === "minimal" ? theme.secondary : theme.accent, 
      align: 'center',
      fontFace: design.fontSecondary
    });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_url, theme: requestedTheme, include_images = true } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    // Check if plan is scholar (PPT is Scholar-only)
    if (profile.plan_type !== 'scholar') {
      return new Response(
        JSON.stringify({ error: 'Scholar plan required. PPT Generator is an exclusive Scholar feature.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check and reset daily credits if needed
    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;

    let dailyCredits = profile.daily_credits;
    let paidCredits = profile.paid_credits || 0;
    const creditsExpiryDate = profile.credits_expiry_date;

    // Check if subscription has expired
    const paidCreditsExpired = creditsExpiryDate ? new Date(creditsExpiryDate) < new Date() : true;
    const isActiveSubscriber = !paidCreditsExpired;

    console.log(`[CREDIT] PPT - User: ${user.id}, Plan: ${profile.plan_type}`);
    console.log(`[CREDIT] Before - Daily: ${profile.daily_credits}, Paid: ${profile.paid_credits}`);

    if (!isActiveSubscriber) {
      return new Response(
        JSON.stringify({ 
          error: 'Your Scholar subscription has expired. Please renew to access the PPT generator feature.',
          subscription_expired: true
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (needsDailyReset) {
      dailyCredits = 8;
    }

    // Credit deduction logic - variable based on image option
    const creditsToDeduct = include_images ? (BASE_CREDIT_COST + IMAGE_CREDIT_COST) : BASE_CREDIT_COST;
    let canProceed = false;
    let creditSource = '';

    if (dailyCredits >= creditsToDeduct) {
      dailyCredits -= creditsToDeduct;
      canProceed = true;
      creditSource = 'daily';
    } else if (dailyCredits > 0 && (dailyCredits + paidCredits) >= creditsToDeduct) {
      const fromDaily = dailyCredits;
      const fromPaid = creditsToDeduct - dailyCredits;
      dailyCredits = 0;
      paidCredits -= fromPaid;
      canProceed = true;
      creditSource = `daily (${fromDaily}) + paid (${fromPaid})`;
    } else if (paidCredits >= creditsToDeduct) {
      paidCredits -= creditsToDeduct;
      canProceed = true;
      creditSource = 'paid';
    }

    if (!canProceed) {
      const totalAvailable = dailyCredits + paidCredits;
      return new Response(
        JSON.stringify({ 
          error: `Insufficient credits. PPT generation requires ${creditsToDeduct} credits. You have ${totalAvailable} credits remaining.`,
          credits_required: creditsToDeduct,
          credits_available: totalAvailable
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CREDIT] PPT - Deducted ${creditsToDeduct} credits from: ${creditSource}, images: ${include_images}`);

    // Select theme - now includes design configuration
    let selectedTheme: Theme;
    if (requestedTheme && requestedTheme !== 'random') {
      // Convert kebab-case ID to theme name for matching
      const themeNameFromId = requestedTheme
        .split('-')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const foundTheme = THEMES.find(t => 
        t.name.toLowerCase() === themeNameFromId.toLowerCase() ||
        t.name.toLowerCase().replace(/[- ]/g, '') === requestedTheme.toLowerCase().replace(/[- ]/g, '')
      );
      
      selectedTheme = foundTheme ?? THEMES[Math.floor(Math.random() * THEMES.length)];
    } else {
      selectedTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
    }
    console.log(`[PPT] Selected theme: ${selectedTheme.name} (${selectedTheme.design.style} style, ${selectedTheme.design.headerStyle} header)`);

    // Get API key early - needed for document extraction
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch document content with proper binary handling for PDF/DOCX
    console.log(`[PPT] Fetching document from: ${document_url.substring(0, 80)}...`);
    const docResponse = await fetch(document_url);
    
    if (!docResponse.ok) {
      console.error(`[PPT] Failed to fetch document: ${docResponse.status}`);
      throw new Error(`Failed to fetch document: ${docResponse.status}`);
    }
    
    const contentType = docResponse.headers.get('content-type') || '';
    console.log(`[PPT] Document content-type: ${contentType}`);
    
    let docContent = '';
    let documentTitle = 'Generated Presentation';
    
    // Binary formats: extract content safely server-side.
    // DOCX is handled via ZIP extraction of word/document.xml (reliable, no AI dependency).
    if (contentType.includes('officedocument') || contentType.includes('wordprocessingml')) {
      const arrayBuffer = await docResponse.arrayBuffer();
      console.log(`[PPT] Extracting DOCX text, size: ${arrayBuffer.byteLength} bytes`);

      docContent = extractDocxText(arrayBuffer).substring(0, 60000);
      console.log(`[PPT] Extracted ${docContent.length} characters from DOCX`);

      const titleMatch = docContent.match(/^(?:#?\s*)?(.+?)[\n\r]/);
      if (titleMatch) {
        documentTitle = titleMatch[1].replace(/[#*]/g, '').trim().substring(0, 100);
      }
    } else if (contentType.includes('pdf')) {
      // Avoid returning a generic 500: PDF extraction needs a dedicated parser.
      console.error('[PPT] PDF detected but PDF text extraction is not configured.');
      return new Response(
        JSON.stringify({ error: 'PDF extraction is temporarily unavailable. Please upload a DOCX file for now.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Plain text content
      const docText = await docResponse.text();
      docContent = docText.substring(0, 50000);
      console.log(`[PPT] Text document, length: ${docContent.length} characters`);
      
      // Extract title from text
      const titleMatch = docContent.match(/^#?\s*(.+?)[\n\r]/);
      if (titleMatch) {
        documentTitle = titleMatch[1].replace(/[#*]/g, '').trim().substring(0, 100);
      }
    }
    
    if (!docContent || docContent.length < 100) {
      throw new Error('Could not extract sufficient content from the document. Please ensure the file is not empty or corrupted.');
    }

    // Enhanced AI prompt for comprehensive academic presentation
    const systemPrompt = `You are an expert academic presentation designer. Analyze research documents and create comprehensive, professional PowerPoint structures.

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON (no markdown, no code fences like \`\`\`json)
- Do NOT include raw newlines inside JSON string values. Keep strings single-line (use spaces).
- No trailing commas.

Return a JSON with this EXACT structure:
{
  "title": "Full Presentation Title",
  "author": "Author name if found in document",
  "institution": "University/Institution if found",
  "slides": [
    {
      "type": "title",
      "title": "Presentation Title",
      "subtitle": "Author Name"
    },
    {
      "type": "content",
      "title": "Slide Title",
      "bullets": ["Point 1 with detail", "Point 2 with detail", "Point 3"],
      "imagePrompt": "Brief description for illustration (optional)"
    }
  ]
}

SLIDE TYPES:
- "title" - Opening slide with title and author
- "section" - Section header (use for major topic transitions)
- "content" - Regular content with bullets
- "table" - For data comparison (include tableData: {headers: [...], rows: [[...]]})
- "conclusion" - Summary points
- "references" - Citation list
- "thankyou" - Final slide

REQUIRED STRUCTURE (include ALL that apply based on document):
1. Title Slide (type: "title") - Extract title, author, institution from document
2. Introduction/Overview (type: "content") - Context and background
3. Problem Statement & Objectives (type: "content") - Research problem and goals
4. Literature Review (type: "content") - Key theories, previous research
5. Methodology (type: "content") - Research design, methods used
6. System Design/Implementation (type: "content") - For technical projects
7. Results/Findings (type: "content" or "table") - Key data and discoveries
8. Discussion (type: "content") - Interpretation of results
9. Conclusion (type: "conclusion") - Key takeaways
10. Future Work/Recommendations (type: "content")
11. References (type: "references") - Key citations
12. Thank You (type: "thankyou")

GUIDELINES:
- Create 10-15 slides for comprehensive coverage
- Each content slide should have 4-6 detailed bullet points
- Extract ACTUAL data, statistics, and specific findings from the document
- Include imagePrompt for 2-3 key slides (methodology, results, system design)
- Make content substantive and specific, not generic
- For tables, extract real data from the document when available`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Analyze this document thoroughly and create a comprehensive academic presentation structure. Extract all key information including actual data, findings, and citations.\n\nDOCUMENT:\n${docContent}${docContent.length > 40000 ? '\n\n[Document truncated - extract all key points from visible content]' : ''}` 
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Lovable AI error:', aiResponse.status, errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const outline = aiData.choices[0].message.content;

    // Parse AI response with robust JSON handling (never leak raw JSON into slides)
    let presentationData: PresentationData;
    try {
      const candidate = extractJsonCandidate(outline);
      if (!candidate) throw new Error("No JSON object found in AI output");
      presentationData = safeJsonParse<PresentationData>(candidate);

      if (!presentationData.slides || !Array.isArray(presentationData.slides) || presentationData.slides.length === 0) {
        throw new Error("Invalid presentation structure");
      }

      // Normalize/sanitize all text fields so we never render markdown/JSON artifacts.
      presentationData.title = sanitizeSlideText(presentationData.title || documentTitle);
      if (presentationData.author) presentationData.author = sanitizeSlideText(presentationData.author);
      if (presentationData.institution) presentationData.institution = sanitizeSlideText(presentationData.institution);

      presentationData.slides = presentationData.slides
        .slice(0, 15)
        .map((s) => ({
          ...s,
          title: s.title ? sanitizeSlideText(s.title) : s.title,
          subtitle: s.subtitle ? sanitizeSlideText(s.subtitle) : s.subtitle,
          bullets: s.bullets?.map(sanitizeSlideText).filter(Boolean),
          imagePrompt: s.imagePrompt ? sanitizeSlideText(s.imagePrompt) : s.imagePrompt,
        }))
        // Remove any slide that ended up empty after sanitization.
        .filter((s) => s.type === "title" || s.type === "thankyou" || (s.title && (s.bullets?.length || s.tableData)));

      // Guardrail: if model output degenerates after sanitization, fall back to doc-driven slides.
      if (presentationData.slides.length < 6) {
        throw new Error("AI output too small after sanitization");
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      console.log('[PPT] AI response (first 500 chars):', outline.substring(0, 500));

      // Fallback: build a real deck from extracted DOCX text (never from the model's raw output)
      presentationData = buildFallbackFromDocContent(docContent, documentTitle);
      console.log('[PPT] Using document-content fallback presentation structure');
    }

    console.log(`[PPT] Generated ${presentationData.slides?.length || 0} slides`);

    // Generate images for select slides (max 3) - only if enabled
    const slideImages: Map<number, string> = new Map();
    
    if (include_images) {
      const slidesWithImagePrompts = presentationData.slides
        .map((s, i) => ({ index: i, prompt: s.imagePrompt }))
        .filter(s => s.prompt)
        .slice(0, 3);

      for (const { index, prompt } of slidesWithImagePrompts) {
        if (prompt) {
          const imageUrl = await generateSlideImage(prompt, selectedTheme, LOVABLE_API_KEY, supabaseClient, user.id);
          if (imageUrl) {
            slideImages.set(index, imageUrl);
          }
        }
      }
      console.log(`[PPT] Generated ${slideImages.size} images`);
    } else {
      console.log(`[PPT] Image generation skipped (disabled by user)`);
    }

    // Create PowerPoint
    const pptx = new PptxGenJS();
    pptx.title = presentationData.title;
    pptx.author = presentationData.author || "ProjectPal";
    pptx.subject = "AI Generated Academic Presentation";

    // Build slides based on type - now with design-aware functions
    for (let i = 0; i < presentationData.slides.length; i++) {
      const slideData = presentationData.slides[i];
      const imageUrl = slideImages.get(i);

      switch (slideData.type) {
        case 'title':
          buildTitleSlide(pptx, slideData, selectedTheme, presentationData);
          break;
        case 'section':
          buildSectionSlide(pptx, slideData, selectedTheme);
          break;
        case 'table':
          buildTableSlide(pptx, slideData, selectedTheme);
          break;
        case 'conclusion':
          buildConclusionSlide(pptx, slideData, selectedTheme);
          break;
        case 'references':
          buildReferencesSlide(pptx, slideData, selectedTheme);
          break;
        case 'thankyou':
          buildThankYouSlide(pptx, selectedTheme, presentationData.author, presentationData.institution);
          break;
        default:
          buildContentSlide(pptx, slideData, selectedTheme, imageUrl);
      }
    }

    // Add Thank You slide if not present
    const hasThankYou = presentationData.slides.some(s => s.type === 'thankyou');
    if (!hasThankYou) {
      buildThankYouSlide(pptx, selectedTheme, presentationData.author, presentationData.institution);
    }

    // Generate PPTX file with meaningful filename
    const pptxData = await pptx.write({ outputType: "base64" });
    const pptxBuffer = Uint8Array.from(atob(pptxData as string), c => c.charCodeAt(0));
    
    const pptBlob = new Blob([pptxBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
    });
    
    // Create meaningful filename from presentation title
    const sanitizedTitle = (presentationData.title || 'presentation')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    const timestamp = Date.now();
    const downloadName = `${sanitizedTitle || 'presentation'}-${timestamp}.pptx`;
    const fileName = `${user.id}/${downloadName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(fileName, pptBlob, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });

    if (uploadError) throw uploadError;

    const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
      .from('documents')
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error('Failed to generate download URL');
    }

    // Update credits
    await supabaseClient
      .from('profiles')
      .update({
        daily_credits: dailyCredits,
        paid_credits: paidCredits,
        daily_reset_date: today,
      })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({
        ppt_url: signedUrlData.signedUrl,
        download_name: downloadName,
        credits_used: creditsToDeduct,
        images_enabled: include_images,
        theme_used: selectedTheme.name,
        design_style: selectedTheme.design.style,
        slides_generated: presentationData.slides.length + (hasThankYou ? 0 : 1),
        images_generated: slideImages.size,
        profile: {
          daily_credits: dailyCredits,
          paid_credits: paidCredits,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-ppt function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
