

# Train AI for Law Student Project Structure

## Overview

The current system prompt in `chat-ai/index.ts` is designed for **science/social science** projects (surveys, questionnaires, hypotheses, ANOVA, Cronbach's alpha, etc.). Law students write **"Long Essays"** with a fundamentally different structure. The AI needs to recognize when a user is a law student and adapt its output accordingly.

## Key Differences Found in the Uploaded Law Projects

From analyzing both documents, here are the structural patterns unique to Nigerian law school long essays:

### Document Label
- Called a **"Long Essay"**, NOT "project" or "thesis"
- Submitted to "College of Law" for "Bachelor of Laws (LL.B Hons)"

### Preliminary Pages (Law-Specific)
- Title Page
- Declaration Page (student declares original work)
- Certification Page (supervisor certifies)
- Dedication
- Acknowledgements
- **Table of Contents**
- **Table of Cases** (e.g., *Donoghue v Stevenson*, *Abacha v Fawehinmi* -- with full citations)
- **Table/List of Statutes** (e.g., FCCPA 2018, CFRN 1999)
- **Table of International Conventions** (optional, if comparative)
- **List of Abbreviations** (e.g., FCCPA, NAFDAC, NDPA, LFN)
- Abstract

### Chapter Structure (Law-Specific)

**Chapter 1 -- General Introduction**
- 1.0 Introduction / Background to the Study
- 1.1 Statement of the Problem
- 1.2 Aim and Objectives of the Study
- 1.3 Research Questions (optional)
- 1.4 Research Methodology (always **doctrinal/qualitative**, never quantitative)
- 1.5 Significance of the Study
- 1.6 Scope and Limitations
- 1.7 Structure/Outline of Chapters
- 1.8 Definition of Terms (legal definitions with case law citations)

**Chapter 2 -- Conceptual/Theoretical Framework and Literature Review**
- 2.0 Introduction
- 2.1 Conceptual Clarification (define legal concepts with case citations and statutory references)
- 2.2 Theoretical/Conceptual analysis of key legal doctrines
- 2.3 Literature Review (organized thematically by legal scholars)
- Subsections use legal analysis, not empirical data

**Chapter 3 -- Legal and Regulatory Framework**
- 3.0 Introduction
- 3.1 Constitutional provisions
- 3.2 Statutory provisions (analyze specific Acts section-by-section)
- 3.3 Regulatory bodies and their roles
- 3.4 Comparative Analysis with other jurisdictions (UK, US, South Africa, EU)
- 3.5 Common law principles and key case law analysis
- 3.6 Challenges and gaps in the legal framework

**Chapter 4 -- Case Analysis / Application of Law**
- 4.0 Introduction
- 4.1-4.X Analysis of landmark cases
- Breach/liability analysis
- Judicial remedies and ADR mechanisms
- Ethical implications
- Institutional roles

**Chapter 5 -- Summary, Conclusion and Recommendations**
- 5.0/5.1 Summary of Findings
- 5.2 Conclusion
- 5.3 Recommendations (legislative reform proposals)

### Citation and Reference Style (Law-Specific)
- **Footnotes** are the primary citation method (not in-text APA)
- Uses **NIALS (Nigerian Institute of Advanced Legal Studies) citation style** or a hybrid footnote style
- Format: Author, 'Title of Article' (Year) Journal Name, Volume, Pages
- Case citations: *Case Name* (Year) Report abbreviation (e.g., NWLR, All ER, QB)
- Statute citations: Full Act name with year and section numbers
- References section called "Bibliography" (sometimes split into Books, Journal Articles, Online Sources)

### Writing Style
- **Doctrinal methodology** (library-oriented, analyzing primary and secondary legal sources)
- Heavy use of case law analysis (not data tables or statistical tests)
- Legal reasoning and argumentation (not hypothesis testing)
- Third person, formal legal writing
- Extensive use of Latin maxims and legal terminology

## Changes

### File: `supabase/functions/chat-ai/index.ts`

**Update the system prompt** (lines 517-618) to add a complete Law department section alongside the existing structure. The AI will detect when a user mentions law, legal topics, LL.B, long essay, statutes, case law, etc., and switch to the law-appropriate structure.

Add the following to the system prompt:

1. A **department detection instruction** telling the AI to identify law students based on keywords (law, legal, LL.B, long essay, statute, case law, tort, contract, criminal law, constitutional law, etc.)

2. A complete **LAW DEPARTMENT PROJECT STRUCTURE** section covering:
   - Preliminary pages with Table of Cases, Table of Statutes, List of Abbreviations
   - All 5 chapters with law-specific subsection patterns
   - Footnote-based citation format (not APA)
   - Doctrinal methodology (not quantitative)
   - Case law analysis patterns
   - Comparative jurisdiction analysis

3. Update the **MANDATORY REFERENCES RULE** for law to specify:
   - Use footnote numbering within text
   - Include a Bibliography at the end (not "References")
   - Split into: Books, Journal Articles, Online Sources, Table of Cases, Table of Statutes
   - All cases must include proper law report citations
   - All statutes must include full title and year

### File: `supabase/functions/document-ai-chat/index.ts`

Apply the same law department structure additions to the Document Editor's system prompt so that law students using the document editor also get properly formatted output.

## Summary

| Change | File |
|--------|------|
| Add law department project structure to system prompt | `supabase/functions/chat-ai/index.ts` |
| Add same law structure to document editor prompt | `supabase/functions/document-ai-chat/index.ts` |

