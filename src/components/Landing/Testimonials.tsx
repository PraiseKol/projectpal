import { Card } from "@/components/ui/card";
import { Quote, Star } from "lucide-react";

// TODO: Replace placeholder testimonials with real verified student quotes.
const TESTIMONIALS = [
  {
    name: "Chinaza O.",
    role: "Computer Science, UNILAG",
    quote:
      "I finished Chapter 3 in one afternoon. The methodology section came out cleaner than what I had been struggling with for weeks.",
  },
  {
    name: "Tobi A.",
    role: "Mass Comm, OAU",
    quote:
      "The PowerPoint generator saved me on defence day. My supervisor said it was the most organized slides she had seen.",
  },
  {
    name: "Halima B.",
    role: "Microbiology, ABU",
    quote:
      "The data analysis tool gave me clean tables and proper interpretation for my Chapter 4. Worth every naira of Scholar.",
  },
];

export const Testimonials = () => (
  <section className="container mx-auto px-4 py-16">
    <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">Loved by Nigerian students</h2>
    <p className="text-center text-muted-foreground mb-10">Real students. Real chapters. Real defence wins.</p>
    <div className="grid md:grid-cols-3 gap-6">
      {TESTIMONIALS.map((t) => (
        <Card key={t.name} className="p-6 rounded-2xl hover:shadow-lg transition-shadow">
          <Quote className="h-7 w-7 text-primary mb-3" />
          <div className="flex gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="text-base mb-4 leading-relaxed">"{t.quote}"</p>
          <div>
            <p className="font-semibold">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.role}</p>
          </div>
        </Card>
      ))}
    </div>
  </section>
);