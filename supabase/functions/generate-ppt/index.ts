import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PptxGenJS from "https://esm.sh/pptxgenjs@3.12.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document_url } = await req.json();
    
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

    if (profile.plan_type !== 'scholar') {
      return new Response(
        JSON.stringify({ error: 'Scholar plan required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check and reset daily credits if needed
    const today = new Date().toISOString().split('T')[0];
    const needsDailyReset = profile.daily_reset_date !== today;

    let dailyCredits = profile.daily_credits;
    let paidCredits = profile.paid_credits || 0;
    const creditsExpiryDate = profile.credits_expiry_date;

    // Check if paid credits have expired
    const paidCreditsExpired = creditsExpiryDate ? new Date(creditsExpiryDate) < new Date() : true;

    // Enhanced logging - before state
    console.log(`[CREDIT] PPT - User: ${user.id}, Plan: ${profile.plan_type}`);
    console.log(`[CREDIT] Before - Daily: ${profile.daily_credits}, Paid: ${profile.paid_credits}`);
    console.log(`[CREDIT] Daily Reset Date: ${profile.daily_reset_date}, Today: ${today}, Needs Reset: ${needsDailyReset}`);
    console.log(`[CREDIT] Expiry: ${creditsExpiryDate}, Expired: ${paidCreditsExpired}`);

    // Reset daily credits if needed (all users get 8 free daily credits)
    if (needsDailyReset) {
      dailyCredits = 8;
      console.log(`[CREDIT] Daily credits reset to 8`);
    }

    // Credit deduction logic for Scholar users:
    // 1. Use daily credits first (free bonus)
    // 2. Then use paid credits (if not expired)
    
    let canProceed = false;
    let creditSource = '';

    if (dailyCredits > 0) {
      dailyCredits -= 1;
      canProceed = true;
      creditSource = 'daily';
    } else if (paidCredits > 0 && !paidCreditsExpired) {
      paidCredits -= 1;
      canProceed = true;
      creditSource = 'paid';
    }

    if (!canProceed) {
      const errorMessage = paidCreditsExpired 
        ? 'Your paid credits have expired. Please purchase more credits.'
        : 'Insufficient credits. Please purchase more credits.';
      
      console.log(`[CREDIT] Insufficient credits - Expired: ${paidCreditsExpired}`);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CREDIT] PPT deducted from: ${creditSource}. After - Daily: ${dailyCredits}, Paid: ${paidCredits}`);

    const docResponse = await fetch(document_url);
    const docText = await docResponse.text();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an assistant that creates PowerPoint presentations. Return a JSON structure with title and slides array. Each slide has a title and bullets array.',
          },
          { 
            role: 'user', 
            content: `Analyze this document and create a PowerPoint presentation structure in JSON format:
{
  "title": "Presentation Title",
  "slides": [
    { "title": "Introduction", "bullets": ["Point 1", "Point 2", "Point 3"] },
    { "title": "Main Topic", "bullets": ["Key insight 1", "Key insight 2"] }
  ]
}

Create 5-8 slides maximum. Document:\n\n${docText.substring(0, 10000)}` 
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

    // Parse AI response to extract JSON
    let presentationData;
    try {
      const jsonMatch = outline.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        presentationData = JSON.parse(jsonMatch[0]);
      } else {
        presentationData = JSON.parse(outline);
      }
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      presentationData = {
        title: "Generated Presentation",
        slides: [
          { title: "Overview", bullets: outline.split('\n').filter((l: string) => l.trim()).slice(0, 5) }
        ]
      };
    }

    // Create PowerPoint using pptxgenjs
    const pptx = new PptxGenJS();
    pptx.title = presentationData.title;
    pptx.author = "ScholarAI Hub";
    pptx.subject = "AI Generated Presentation";

    // Add title slide
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: "FFFFFF" };
    titleSlide.addText(presentationData.title, {
      x: 0.5,
      y: 2.0,
      w: 9.0,
      h: 1.5,
      fontSize: 36,
      bold: true,
      color: "363636",
      align: "center"
    });
    titleSlide.addText("Generated by ScholarAI Hub", {
      x: 0.5,
      y: 3.5,
      w: 9.0,
      h: 0.5,
      fontSize: 14,
      color: "666666",
      align: "center"
    });

    // Add content slides
    presentationData.slides.forEach((slideData: any) => {
      const slide = pptx.addSlide();
      slide.background = { color: "FFFFFF" };
      
      // Add slide title
      slide.addText(slideData.title, {
        x: 0.5,
        y: 0.5,
        w: 9.0,
        h: 0.75,
        fontSize: 28,
        bold: true,
        color: "363636"
      });

      // Add bullet points
      const bullets = Array.isArray(slideData.bullets) ? slideData.bullets : [];
      bullets.forEach((bullet: string, i: number) => {
        slide.addText(bullet, {
          x: 0.75,
          y: 1.5 + (i * 0.6),
          w: 8.5,
          h: 0.5,
          fontSize: 16,
          color: "444444",
          bullet: true
        });
      });
    });

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

    // Update credits with new logic
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        daily_credits: dailyCredits,
        paid_credits: paidCredits,
        daily_reset_date: today,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating credits:', updateError);
    }

    return new Response(
      JSON.stringify({
        ppt_url: urlData.publicUrl,
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
