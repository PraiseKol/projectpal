import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { ArrowLeft, Calendar, AlertCircle } from "lucide-react";

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author: string | null;
  published_at: string | null;
}

const Blog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    supabase
      .from("blog_posts")
      .select("id,slug,title,excerpt,cover_image_url,author,published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .then(({ data, error: err }) => {
        if (err) {
          setError(true);
        } else {
          setPosts(data || []);
        }
        setLoading(false);
      });
  };

  useEffect(load, []);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="ProjectPal Blog — Academic Writing Tips for Nigerian Students"
        description="Learn how to write Chapter 3 methodology, literature reviews, pick project topics, and defend your final year project. Free guides for Nigerian university students."
        keywords="chapter 3 methodology, literature review guide, project topics Nigeria, final year project, research methodology"
        canonical="/blog"
      />
      <header className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2">
          <ProjectPalLogo size="sm" />
        </Link>
        <Button variant="ghost" asChild>
          <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Home</Link>
        </Button>
      </header>
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">ProjectPal Blog</h1>
        <p className="text-lg text-muted-foreground mb-10">
          Practical guides for writing your final year project — from topic selection to defence.
        </p>
        {loading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">We couldn't load the posts right now.</p>
            <Button onClick={load}>Try again</Button>
          </div>
        ) : posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet. Check back soon.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`}>
                <Card className="p-6 h-full hover:shadow-lg transition-all hover:scale-[1.01] rounded-2xl">
                  {p.cover_image_url && (
                    <img src={p.cover_image_url} alt={p.title} loading="lazy" className="rounded-xl mb-4 w-full h-48 object-cover" />
                  )}
                  <h2 className="text-xl font-bold mb-2">{p.title}</h2>
                  <p className="text-muted-foreground text-sm mb-3 line-clamp-3">{p.excerpt}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {p.published_at && new Date(p.published_at).toLocaleDateString()}
                    {p.author && <span>• {p.author}</span>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Blog;
