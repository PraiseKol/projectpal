import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CREDIT_COST = 1;

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  citationCount: number;
  authors: { name: string }[];
  externalIds?: { DOI?: string };
  url: string;
}

interface ArticleResult {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  abstract: string | null;
  citationCount: number;
  doi: string | null;
  url: string;
  apaReference: string;
}

function formatAPAReference(paper: SemanticScholarPaper): string {
  const authors = paper.authors.map(a => a.name);
  let authorStr = '';
  
  if (authors.length === 1) {
    authorStr = authors[0];
  } else if (authors.length === 2) {
    authorStr = `${authors[0]} & ${authors[1]}`;
  } else if (authors.length > 2) {
    authorStr = `${authors[0]} et al.`;
  } else {
    authorStr = 'Unknown Author';
  }
  
  const year = paper.year || 'n.d.';
  const title = paper.title;
  const doi = paper.externalIds?.DOI ? ` https://doi.org/${paper.externalIds.DOI}` : '';
  
  return `${authorStr} (${year}). ${title}.${doi}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 10 } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Please provide a search query (at least 3 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile and check credits
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('daily_credits, monthly_credits, paid_credits, plan_type, credits_expiry_date, daily_reset_date')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error('Failed to fetch user profile');
    }

    // Check subscription status
    const paidCreditsExpired = profile.credits_expiry_date 
      ? new Date(profile.credits_expiry_date) < new Date() 
      : true;
    const isActiveSubscriber = profile.plan_type !== 'free' && !paidCreditsExpired;

    // Calculate available credits
    const totalAvailable = isActiveSubscriber 
      ? profile.daily_credits + profile.paid_credits 
      : Math.min(profile.daily_credits, profile.monthly_credits);

    if (totalAvailable < CREDIT_COST) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient credits. Please upgrade your plan.',
          credits_required: CREDIT_COST,
          credits_available: totalAvailable 
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search Semantic Scholar API (free, no API key required for basic usage)
    const searchUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query.trim())}&limit=${Math.min(limit, 20)}&fields=paperId,title,abstract,year,citationCount,authors,externalIds,url`;
    
    console.log(`[ARTICLE_SEARCH] Searching for: "${query}" (user: ${user.id})`);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!searchResponse.ok) {
      if (searchResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Search rate limit reached. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Semantic Scholar API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const papers: SemanticScholarPaper[] = searchData.data || [];

    // Format results
    const articles: ArticleResult[] = papers.map(paper => ({
      id: paper.paperId,
      title: paper.title,
      authors: paper.authors.map(a => a.name).join(', ') || 'Unknown',
      year: paper.year,
      abstract: paper.abstract,
      citationCount: paper.citationCount || 0,
      doi: paper.externalIds?.DOI || null,
      url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
      apaReference: formatAPAReference(paper),
    }));

    // Deduct credits
    let dailyCredits = profile.daily_credits;
    let monthlyCredits = profile.monthly_credits;
    let paidCredits = profile.paid_credits;

    if (isActiveSubscriber) {
      if (dailyCredits >= CREDIT_COST) {
        dailyCredits -= CREDIT_COST;
      } else {
        paidCredits -= CREDIT_COST;
      }
    } else {
      dailyCredits -= CREDIT_COST;
      monthlyCredits -= CREDIT_COST;
    }

    // Update credits
    const today = new Date().toISOString().split('T')[0];
    await supabaseClient
      .from('profiles')
      .update({
        daily_credits: dailyCredits,
        monthly_credits: monthlyCredits,
        paid_credits: paidCredits,
        daily_reset_date: today,
      })
      .eq('id', user.id);

    console.log(`[ARTICLE_SEARCH] Found ${articles.length} articles, deducted ${CREDIT_COST} credit`);

    return new Response(
      JSON.stringify({
        articles,
        total: searchData.total || articles.length,
        credits_used: CREDIT_COST,
        profile: {
          daily_credits: dailyCredits,
          monthly_credits: monthlyCredits,
          paid_credits: paidCredits,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-articles function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An error occurred while searching' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
