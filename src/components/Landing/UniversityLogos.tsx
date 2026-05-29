const UNIVERSITIES = [
  "UNILAG",
  "University of Ibadan",
  "OAU",
  "FUTA",
  "ABU Zaria",
  "UNN",
  "Covenant",
  "UI",
];

export const UniversityLogos = () => (
  <section className="container mx-auto px-4 py-10">
    <p className="text-center text-sm uppercase tracking-wider text-muted-foreground mb-6">
      Used by students at
    </p>
    <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-3">
      {UNIVERSITIES.map((u) => (
        <span key={u} className="text-base md:text-lg font-semibold text-muted-foreground/70">
          {u}
        </span>
      ))}
    </div>
  </section>
);