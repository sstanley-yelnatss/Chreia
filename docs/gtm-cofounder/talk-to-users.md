# Chreia — talk to users (TAB)

**Status:** Ready to recruit. 0 interviews done.  
**Rule:** TAB calls are interviews, not demos. Do not pitch Chreia on the call. Mine pain in their words.

---

## Personas to cover (from brief)

| Persona | Hypothesis | Priority |
|---------|------------|----------|
| A. Team PR reviewer (SWE / tech lead) | Reviews others' AI-heavy PRs; intent missing from diff | High |
| B. Semi-technical solo founder | Owns both authoring and review; loses trail across agent chats | High |
| C. Eng manager (buyer-adjacent) | Owns review queue / quality bar; may pay later | Medium (after A/B pain is real) |

Need TAB members in **A and B** first. That is how you resolve the dual-ICP tension.

---

## Locked 7 questions (30 min, no more)

Task framing for the call: **"how you review PRs when a lot of the code was written with AI / agents."**

1. **Magic wand:** If you could wave a magic wand and change anything about how you review (or ship) AI-assisted PRs, what would it be?
2. **Stakes:** If that were fixed, how would your day or your team's shipping change?
3. **Why now:** What's different in the last 1–2 years that makes this worse than before?
4. What caused this problem in your org (or in how you work solo)?
5. What have you tried (PR templates, intent checklists, AI PR descriptions, requiring authors on Zoom, etc.), and why did it fall short?
6. What happens if nothing changes for another year?
7. Where do you go to stay current on AI coding + review practice? (who/what you trust)

After the call (optional, 2 min): ask if they'd join a light **technical advisory board** (monthly 30 min, early access, no pay). Still no demo unless they ask.

---

## Outreach (max 4 sentences, personalized)

**Template shape (Frankl):**
```
Hey [Name],

[One specific line about *their* post/comment.]

I'm researching how teams review AI-assisted PRs when the intent isn't in the diff,
and your take would help a lot. Would you do a 20–30 min call / join a small
technical advisory board for that?

No pitch deck. Just questions. Happy to work around your calendar.
```

**Do not** lead with Chreia, installer, or "local reasoning timelines."

---

## First 10 people (publicly posted about the problem)

Find email / LinkedIn / X yourself from the handle. Personalize the bracketed line. Send **today**.

| # | Who | Persona lean | Proof they feel it | First personalization line |
|---|-----|--------------|--------------------|----------------------------|
| 1 | **captainkrtek** (HN) | A / B | Asked HN: reviewers only get the artifact; missing plans/prompts/tradeoffs | "Your Ask HN on reviewing gen-AI code nailed the missing piece: the dialog that produced the change never shows up in the PR." |
| 2 | **jfreds** (HN) | A | AI PR descriptions are fluff; first review round is interrogation before looking at code | "Your comment on AI PR descriptions burning you out (questions before you even open the diff) is exactly the pain I'm mapping." |
| 3 | Commenters on [Ask HN: How do you review gen-AI created code?](https://news.ycombinator.com/item?id=47330747) | A | Same thread | Pick 2 people who described a real process, not vibes. Quote *their* sentence. |
| 4 | Author of LLM-in-comments approach on [HN](https://news.ycombinator.com/item?id=47308173) | A | Team can't see original prompt/flow; embeds reasoning in code comments as proxy | "Your note about reviewers not seeing the original agent prompt/flow, and using comments as a stand-in, is a sharp workaround I want to understand." |
| 5 | Skeptical voice on AI PR descriptions ([HN PR-Agent thread](https://news.ycombinator.com/item?id=41500840)) | A | "Context that made a change necessary can't be inferred from the change" | "You wrote that PR context can't live in the diff itself. I want to hear how your team handles that when AI authors the code." |
| 6–8 | Fresh Reddit / Cursor forum posters (last 48–72h) | A / B | Run `scout Chreia` → take fit ≥4 | Use their exact complaint in sentence 1. Prefer review-queue / "why did the agent" / lost session, not generic Cursor bugs. |
| 9–10 | 2 people from your network who are **not friends-of-convenience** (weak ties, former coworkers, Discord acquaintances) | A or B | They ship with Cursor/Claude Code | Same template; still no product pitch. |

**Volume math:** ~10% reply → 10 sends ≈ 1 reply. Plan **50 personalized** over the 2-week syllabus for ~5 calls. Today's job is the first 10.

---

## Call log (fill as you go)

| Date | Person | Persona | Quotes (full sentences) | Pains / Gains / Jobs / Changes | Would TAB? |
|------|--------|---------|-------------------------|--------------------------------|------------|
| | | | | | |

### Synthesis table (after ≥3 calls)

| Bucket | Top quotes (their words) |
|--------|--------------------------|
| **Pains** | |
| **Gains** | |
| **Jobs** | |
| **Environmental changes** (villain) | |

When this table has real quotes → run `positioning-and-story` and flip brief tags to `[validated]`.

---

## Your next 30 minutes

1. Send the 5 named HN outreaches (1–5) via HN reply, email, or LinkedIn if you can find them.
2. Run `scout Chreia` and add 3–5 fresh names to rows 6–8; send those too.
3. Put the 7 questions in a note you can see during Zoom. Do not demo.
4. After call 1: paste quotes into the log; update `founder-brief.md` evidence hygiene.

**Hard rule reminder:** friends are out. Polite people who already like you will not kill a bad ICP.
