import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PptxGenJS from "https://esm.sh/pptxgenjs@3.12.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_CREDIT_COST = 6;
const IMAGE_CREDIT_COST = 2;

// Theme definitions based on professional presentation styles
interface Theme {
  name: string;
  primary: string;
  secondary: string;
  background: string;
  headerBg: string;
  text: string;
  accent: string;
  bulletColor: string;
}

const THEMES: Theme[] = [
  {
    name: "Academic Blue",
    primary: "1A365D",
    secondary: "F5A962",
    background: "0F172A",
    headerBg: "1E3A5F",
    text: "FFFFFF",
    accent: "F97316",
    bulletColor: "F5A962"
  },
  {
    name: "Professional Teal",
    primary: "0D9488",
    secondary: "14B8A6",
    background: "042F2E",
    headerBg: "115E59",
    text: "FFFFFF",
    accent: "2DD4BF",
    bulletColor: "5EEAD4"
  },
  {
    name: "Classic Red-Orange",
    primary: "DC2626",
    secondary: "F97316",
    background: "7F1D1D",
    headerBg: "991B1B",
    text: "FFFFFF",
    accent: "FCD34D",
    bulletColor: "FBBF24"
  },
  {
    name: "Warm Gradient",
    primary: "92400E",
    secondary: "F59E0B",
    background: "FFFBEB",
    headerBg: "F59E0B",
    text: "1F2937",
    accent: "7C3AED",
    bulletColor: "D97706"
  },
  {
    name: "Formal Green",
    primary: "166534",
    secondary: "F59E0B",
    background: "F0FDF4",
    headerBg: "166534",
    text: "1F2937",
    accent: "15803D",
    bulletColor: "166534"
  },
  {
    name: "Modern Purple",
    primary: "7C3AED",
    secondary: "A78BFA",
    background: "1E1B4B",
    headerBg: "4C1D95",
    text: "FFFFFF",
    accent: "C4B5FD",
    bulletColor: "A78BFA"
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

// Generate AI image for slides
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
      const base64Data = base64Image.split(',')[1];
      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' });
      const imageName = `${userId}/ppt-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
      
      const { error: uploadError } = await supabaseClient.storage
        .from('documents')
        .upload(imageName, imageBlob, { contentType: 'image/png' });
      
      if (uploadError) {
        console.error('[IMAGE] Upload failed:', uploadError);
        return null;
      }
      
      const { data: imgUrl } = supabaseClient.storage.from('documents').getPublicUrl(imageName);
      console.log('[IMAGE] Generated and uploaded successfully');
      return imgUrl.publicUrl;
    }
  } catch (e) {
    console.error('[IMAGE] Generation error:', e);
  }
  return null;
}

// Build title slide
function buildTitleSlide(pptx: PptxGenJS, data: SlideData, theme: Theme, presentationData: PresentationData) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  
  // Add decorative header bar
  slide.addShape(pptx.ShapeType.rect, { 
    x: 0, y: 0, w: '100%', h: 0.8, 
    fill: { color: theme.primary } 
  });
  
  // Add accent line
  slide.addShape(pptx.ShapeType.rect, { 
    x: 0, y: 0.8, w: '100%', h: 0.05, 
    fill: { color: theme.secondary } 
  });
  
  // Main title
  slide.addText(data.title || presentationData.title, {
    x: 0.5, y: 2.2, w: 9, h: 1.2,
    fontSize: 40, bold: true, color: theme.text, align: 'center',
    fontFace: 'Arial'
  });
  
  // Subtitle/Author
  const subtitle = data.subtitle || presentationData.author || '';
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 3.5, w: 9, h: 0.6,
      fontSize: 20, color: theme.accent, align: 'center',
      fontFace: 'Arial'
    });
  }
  
  // Institution
  if (presentationData.institution) {
    slide.addText(presentationData.institution, {
      x: 0.5, y: 4.2, w: 9, h: 0.5,
      fontSize: 16, color: theme.secondary, align: 'center',
      fontFace: 'Arial'
    });
  }
  
  // Bottom decorative element
  slide.addShape(pptx.ShapeType.rect, { 
    x: 3.5, y: 4.9, w: 3, h: 0.04, 
    fill: { color: theme.secondary } 
  });
}

// Build content slide with optional image
function buildContentSlide(pptx: PptxGenJS, data: SlideData, theme: Theme, imageUrl?: string) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  
  // Header bar with title
  slide.addShape(pptx.ShapeType.rect, { 
    x: 0, y: 0, w: '100%', h: 1, 
    fill: { color: theme.headerBg } 
  });
  
  // Accent line under header
  slide.addShape(pptx.ShapeType.rect, { 
    x: 0, y: 1, w: '100%', h: 0.03, 
    fill: { color: theme.secondary } 
  });
  
  slide.addText(data.title, {
    x: 0.4, y: 0.25, w: 9.2, h: 0.6,
    fontSize: 26, bold: true, color: 'FFFFFF',
    fontFace: 'Arial'
  });
  
  // Content area - adjust width if image present
  const contentWidth = imageUrl ? 5.5 : 9;
  const bullets = data.bullets || [];
  
  bullets.forEach((bullet, i) => {
    if (i < 7) { // Max 7 bullets per slide
      slide.addText(`• ${bullet}`, {
        x: 0.5, y: 1.3 + (i * 0.65), w: contentWidth, h: 0.6,
        fontSize: 15, color: theme.text,
        fontFace: 'Arial',
        valign: 'top'
      });
    }
  });
  
  // Add image if available (right side)
  if (imageUrl) {
    try {
      slide.addImage({
        path: imageUrl,
        x: 6.0, y: 1.3, w: 3.5, h: 3.5
      });
    } catch (e) {
      console.error('Failed to add image to slide:', e);
    }
  }
}

// Build section header slide
function buildSectionSlide(pptx: PptxGenJS, data: SlideData, theme: Theme) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.primary };
  
  // Large centered title
  slide.addText(data.title, {
    x: 0.5, y: 2.3, w: 9, h: 1,
    fontSize: 44, bold: true, color: 'FFFFFF', align: 'center',
    fontFace: 'Arial'
  });
  
  // Decorative line
  slide.addShape(pptx.ShapeType.rect, { 
    x: 3, y: 3.5, w: 4, h: 0.05, 
    fill: { color: theme.secondary } 
  });
  
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.5, y: 3.8, w: 9, h: 0.5,
      fontSize: 18, color: theme.accent, align: 'center',
      fontFace: 'Arial'
    });
  }
}

// Build table slide
function buildTableSlide(pptx: PptxGenJS, data: SlideData, theme: Theme) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  
  // Header
  slide.addShape(pptx.ShapeType.rect, { 
    x: 0, y: 0, w: '100%', h: 1, 
    fill: { color: theme.headerBg } 
  });
  
  slide.addText(data.title, {
    x: 0.4, y: 0.25, w: 9.2, h: 0.6,
    fontSize: 26, bold: true, color: 'FFFFFF',
    fontFace: 'Arial'
  });
  
  if (data.tableData && data.tableData.headers && data.tableData.rows) {
    const tableRows: any[] = [];
    
    // Header row
    tableRows.push(data.tableData.headers.map(h => ({
      text: h, options: { bold: true, fill: { color: theme.primary }, color: 'FFFFFF', fontSize: 12 }
    })));
    
    // Data rows
    data.tableData.rows.forEach((row, i) => {
      tableRows.push(row.map(cell => ({
        text: cell, options: { fill: { color: i % 2 === 0 ? 'F3F4F6' : 'FFFFFF' }, color: '374151', fontSize: 11 }
      })));
    });
    
    slide.addTable(tableRows, {
      x: 0.5, y: 1.3, w: 9,
      border: { pt: 0.5, color: 'E5E7EB' },
      fontFace: 'Arial'
    });
  }
}

// Build conclusion slide
function buildConclusionSlide(pptx: PptxGenJS, data: SlideData, theme: Theme) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  
  // Header with different style for conclusion
  slide.addShape(pptx.ShapeType.rect, { 
    x: 0, y: 0, w: '100%', h: 1.2, 
    fill: { color: theme.primary } 
  });
  
  slide.addText(data.title, {
    x: 0.4, y: 0.35, w: 9.2, h: 0.6,
    fontSize: 28, bold: true, color: 'FFFFFF',
    fontFace: 'Arial'
  });
  
  const bullets = data.bullets || [];
  bullets.forEach((bullet, i) => {
    if (i < 6) {
      slide.addText(`✓ ${bullet}`, {
        x: 0.5, y: 1.5 + (i * 0.7), w: 9, h: 0.6,
        fontSize: 16, color: theme.text,
        fontFace: 'Arial'
      });
    }
  });
}

// Build references slide
function buildReferencesSlide(pptx: PptxGenJS, data: SlideData, theme: Theme) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  
  slide.addShape(pptx.ShapeType.rect, { 
    x: 0, y: 0, w: '100%', h: 1, 
    fill: { color: theme.headerBg } 
  });
  
  slide.addText("References", {
    x: 0.4, y: 0.25, w: 9.2, h: 0.6,
    fontSize: 26, bold: true, color: 'FFFFFF',
    fontFace: 'Arial'
  });
  
  const refs = data.bullets || [];
  refs.forEach((ref, i) => {
    if (i < 8) {
      slide.addText(`[${i + 1}] ${ref}`, {
        x: 0.5, y: 1.3 + (i * 0.55), w: 9, h: 0.5,
        fontSize: 12, color: theme.text,
        fontFace: 'Arial'
      });
    }
  });
}

// Build thank you slide
function buildThankYouSlide(pptx: PptxGenJS, theme: Theme, author?: string, institution?: string) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.primary };
  
  slide.addText("Thank You!", {
    x: 0.5, y: 1.8, w: 9, h: 1.2,
    fontSize: 52, bold: true, color: 'FFFFFF', align: 'center',
    fontFace: 'Arial'
  });
  
  slide.addText("Questions & Discussion", {
    x: 0.5, y: 3.2, w: 9, h: 0.6,
    fontSize: 22, color: theme.secondary, align: 'center',
    fontFace: 'Arial'
  });
  
  // Decorative line
  slide.addShape(pptx.ShapeType.rect, { 
    x: 3.5, y: 4, w: 3, h: 0.04, 
    fill: { color: theme.secondary } 
  });
  
  if (author) {
    slide.addText(author, {
      x: 0.5, y: 4.3, w: 9, h: 0.5,
      fontSize: 16, color: 'FFFFFF', align: 'center',
      fontFace: 'Arial'
    });
  }
  
  if (institution) {
    slide.addText(institution, {
      x: 0.5, y: 4.8, w: 9, h: 0.4,
      fontSize: 14, color: theme.accent, align: 'center',
      fontFace: 'Arial'
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

    // Select theme
    let selectedTheme: Theme;
    if (requestedTheme && requestedTheme !== 'random') {
      const themeMap: Record<string, number> = {
        'academic-blue': 0,
        'professional-teal': 1,
        'classic-red': 2,
        'warm-gradient': 3,
        'formal-green': 4,
        'modern-purple': 5
      };
      selectedTheme = THEMES[themeMap[requestedTheme] ?? Math.floor(Math.random() * THEMES.length)];
    } else {
      selectedTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
    }
    console.log(`[PPT] Selected theme: ${selectedTheme.name}`);

    // Fetch document content
    const docResponse = await fetch(document_url);
    const docText = await docResponse.text();
    const docContent = docText.substring(0, 30000); // Increased limit

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Enhanced AI prompt for comprehensive academic presentation
    const systemPrompt = `You are an expert academic presentation designer. Analyze research documents and create comprehensive, professional PowerPoint structures.

Return a JSON with this EXACT structure (no markdown, just pure JSON):
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
            content: `Analyze this document thoroughly and create a comprehensive academic presentation structure. Extract all key information including actual data, findings, and citations.\n\nDOCUMENT:\n${docContent}${docText.length > 30000 ? '\n\n[Document truncated - extract all key points from visible content]' : ''}` 
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

    // Parse AI response
    let presentationData: PresentationData;
    try {
      const jsonMatch = outline.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        presentationData = JSON.parse(jsonMatch[0]);
      } else {
        presentationData = JSON.parse(outline);
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      presentationData = {
        title: "Generated Presentation",
        slides: [
          { type: "content", title: "Overview", bullets: outline.split('\n').filter((l: string) => l.trim()).slice(0, 5) }
        ]
      };
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
    pptx.author = presentationData.author || "ScholarAI Hub";
    pptx.subject = "AI Generated Academic Presentation";

    // Build slides based on type
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

    // Generate PPTX file
    const pptxData = await pptx.write({ outputType: "base64" });
    const pptxBuffer = Uint8Array.from(atob(pptxData as string), c => c.charCodeAt(0));
    
    const pptBlob = new Blob([pptxBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
    });
    const fileName = `${user.id}/ppt-${Date.now()}.pptx`;

    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(fileName, pptBlob, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseClient.storage
      .from('documents')
      .getPublicUrl(fileName);

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
        ppt_url: urlData.publicUrl,
        credits_used: creditsToDeduct,
        images_enabled: include_images,
        theme_used: selectedTheme.name,
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
