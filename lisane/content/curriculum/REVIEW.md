# Curriculum review

[Introduce yourself at work](english/intro/introduce-yourself-at-work.json) is the first draft unit. Review status in the file applies to the whole unit for each language.

| Language | Status | What to review |
|---|---|---|
| English (`en`) | Draft | Check the lesson sequence, English examples and answers, and the coworker roleplay. English-only learners use short English paraphrases for meaning exercises. |
| Amharic (`am`) | Addis draft | Check the guidebook, roleplay task, phrase meanings and hints. Look for natural Ethiopic wording and a consistent level of formality. |
| Afaan Oromo (`om`) | Addis draft | Check the guidebook, roleplay task, phrase meanings and hints. Review Qubee spelling and the wording a learner would use with a new coworker. |

For either support language, check that phrase meanings work in both directions. Put additional acceptable translations in the corresponding meaning's `alternatives` array. Guidebook notes can use different examples for each language.

Once the unit text for a language is approved, change its `review` value to `approved`. Run `pnpm curriculum:validate` from the Lisane app directory after edits.
