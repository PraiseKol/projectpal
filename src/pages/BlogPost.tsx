import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { ProjectPalLogo } from "@/components/ProjectPalLogo";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ArrowLeft, Calendar } from "lucide-react";

const BlogPost = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle()
      .then(({ data }) => {
        setPost(data);
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    if (post) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.meta_description || post.excerpt,
        author: { "@type": "Person", name: post.author || "ProjectPal Team" },
        datePublished: post.published_at,
        dateModified: post.updated_at,
        image: post.cover_image_url || undefined,
      });
      document.head.appendChild(script);
      return () => { script.remove(); };
    }
  }, [post]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Post not found.</p>
        <Button onClick={() => navigate("/blog")}>Back to Blog</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${post.title} | ProjectPal Blog`}
        description={post.meta_description || post.excerpt || post.title}
        keywords={post.keywords || undefined}
        canonical={`/blog/${post.slug}`}
        ogImage={post.cover_image_url || undefined}
      />
      <header className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2">
          <ProjectPalLogo size="sm" />
        </Link>
        <Button variant="ghost" asChild>
          <Link to="/blog"><ArrowLeft className="h-4 w-4 mr-2" />All Posts</Link>
        </Button>
      </header>
      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Calendar className="h-4 w-4" />
          {post.published_at && new Date(post.published_at).toLocaleDateString()}
          {post.author && <span>• {post.author}</span>}
        </div>
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={post.title} className="rounded-2xl mb-8 w-full" />
        )}
        <MarkdownRenderer content={post.content} className="prose-lg" />
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 text-center">
          <h3 className="text-2xl font-bold mb-2">Ready to write your project?</h3>
          <p className="text-muted-foreground mb-4">ProjectPal helps you generate chapters, references, and slides in minutes.</p>
          <Button variant="gradient" size="lg" onClick={() => navigate("/auth")}>Start Free</Button>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;