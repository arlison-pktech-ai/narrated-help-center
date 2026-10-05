# Content: planning and writing the help

`scripts/help/content.mjs` is the single source of every word: the page, the in-app help and an assistant read it. It is plain data (no imports), so the app's bundler and Node can both load it. If the app imports it, keep the `.mjs` extension or make sure the package is `"type": "module"`, and point `contentModule` in `help.config.mjs` to its new place.

## Contents

1. Planning the tutorials
2. The schema
3. Writing rules, with examples
4. Numbers, pictures and parts
5. Screens, phone, FAQ, glossary, quick tasks
6. What `build.mjs` checks

## 1. Planning the tutorials

Make an inventory before writing:

1. Walk the app's navigation and list every **task** a user performs (verbs: add, change, delete, connect, pay, export, invite…), including first-time setup, integrations and settings.
2. Rate each by how often people do it and how hard it is. Frequent + simple tasks become the "What do you want to do?" quick list; rare + hard ones (connecting an integration, importing data) need the most careful steps and their own video.
3. One tutorial per task. A task with variants becomes one tutorial with **parts** ("Record an expense", "Record a card purchase", "Edit or delete") instead of near-duplicate tutorials.
4. Group tutorials by journey: *First steps* (setup the user does once), *Day to day*, *Connections/Integrations*, *Understanding the numbers/reports*, *Settings*. Three to five groups.
5. Decide the videos: one per frequent task and one per hard task. Not every tutorial needs a video; every video needs a tutorial.
6. Show the plan (groups, tutorials, videos) to the user before writing it all.

Good tutorial titles are the task in the user's words, verb first: "Add a task", "Pay the card bill", "Connect your bank". Not "Task management" or "The invoices module".

## 2. The schema

```js
export const GROUPS = [{ id: "start", title: "First steps" }];

export const TUTORIALS = [{
  id: "add-task",                    // lowercase-hyphen; the page anchor (#add-task) and the in-app topic id
  group: "start",                    // a GROUPS id
  title: "Add a task",               // the task, verb first
  summary: "Write down something you need to do, with a date.",   // one line: what it is for
  keywords: "new create todo reminder due date",                  // other words people type
  video: { file: "01-add-task", title: "How to add a task", icon: "<svg …>" },  // optional; icon for the cover
  before: ["Have the **name** of the item at hand."],              // optional: prerequisites
  intro: "The **Inbox** gathers what needs you…",                  // optional: one paragraph of context
  parts: [{
    title: "Change a task",          // optional when there is a single part
    video: { file: "05-edit-task", title: "How to change a task" },   // optional: a video of this part only
    blocks: [{
      image: "add-task-2-form",      // img/<image>.jpg from the stills spec; optional (text-only steps)
      alt: "New task form filled in",
      steps: [{ n: 2, text: "In **Title**, write what you need to do. Example: Pay the electricity bill." }],
      extras: [{ n: "A", text: "**Notes** is optional." }],  // letters, drawn on the same picture
      note: "A tip under this block.",
    }],
    note: "A tip at the end of the part.",
  }],
  done: "The task appears in **Due today** or in **Coming up**, by its date.",
  problems: ["**Save does nothing?** The title is empty: a message in red asks you to write one."],
}];

export const SCREENS = [{ name: "Today", image: "screen-today", text: "What to do today.", parts: ["**Due today**: …", "**Coming up**: …"] }];
export const PHONE = { video, install: ["**iPhone:** …"], blocks: [/* like tutorial blocks */], title?, summary?, keywords? };  // or null
export const FAQ = [{ title: "Tasks", items: [["Question in the user's words?", "Answer in one to three sentences."]] }];
export const GLOSSARY = [["Due date", "The day a task must be done."]];
export const QUICK = [["add-task", "Add a task"]];   // "What do you want to do?"
```

Only `**bold**` and `[text](url)` are formatting. `[text](#id)` links to a tutorial or to `#screens`, `#phone`, `#faq`, `#glossary`.

## 3. Writing rules, with examples

Write for someone who is not technical, is in a hurry and is looking at the screen.

| Rule | Instead of | Write |
| --- | --- | --- |
| One action per step | "Open Projects and create a new one named Garden." | 1 "In the menu, click **Projects**." 2 "Click **+ Project**." 3 "In **Name**, write the name. Example: Garden." |
| Where, then what | "Click **Export**." (on a long page) | "At the bottom of **Settings**, click **Export**." |
| The exact label in bold | "Click the save button." | "Click **Save**." |
| An example for typed fields | "Enter the amount." | "Type the **amount**. Only digits: 4590 becomes $45.90." |
| Explain a control by its effect | "Toggle **Paid**." | "**Paid** on means the money already left. Turn it off if you will pay later." |
| No jargon | "Configure the webhook endpoint." | "Paste the **address** you copied from the bank's site." |
| Say what the user sees next | "Saved." | "The task appears in **Coming up**, on its day." |
| Tips as symptom → fix | "Validation errors may occur." | "**Save does nothing?** The title is empty: a message in red asks you to write one." |

More rules:

- Short sentences (≤ 20 words), second person, present tense, active voice.
- The words must match the screen *exactly*: copy labels from the UI or its translation files, keep their capitalization and symbols ("+ Project", "…"). If a label is unclear to users, fix the UI or explain it once in the glossary — do not rename it in the help.
- Mention positions only when they help: "at the top right", "at the end of the row", "below the menu".
- Name icon-only buttons by what they look like and their accessible name: "the **three dots (…)**", "the **eye**".
- Never promise features that do not exist; never describe what the demo data cannot show. Note what you find broken or confusing while writing, for the report.
- Steps on another company's site (an API key page, a bank, an email): do not guess their labels from memory. Describe what to look for in plain words and link to that service's own help page.
- `before` lists what to have at hand (a balance, a key, a document), not generic advice.
- `problems` covers the real failure modes: required fields, wrong date or account, duplicates, permissions, what deletion does. Two to four.

The same tutorial in Portuguese (pt-BR), in the tone of a product for lay users:

```js
{ id: "conta", group: "primeiros-passos", title: "Adicionar uma conta",
  summary: "Conta do banco, poupança, dinheiro na carteira ou vale-refeição.",
  before: ["Tenha em mãos o **saldo de hoje** da conta. Você vê esse valor no aplicativo do seu banco."],
  parts: [{ blocks: [
    { image: "conta-1-botao", alt: "Tela Contas com o botão + Conta marcado", steps: [
      { n: 1, text: "No menu, clique em **Contas**." },
      { n: 2, text: "Clique no botão **+ Conta**, no alto à direita." } ] },
    { image: "conta-3-formulario", alt: "Formulário Nova conta preenchido", steps: [
      { n: 3, text: "Em **Nome**, escreva um nome fácil. Exemplo: Poupança Aurora." },
      { n: 4, text: "Em **Saldo inicial**, escreva quanto tem na conta hoje. Exemplo: 2500,00." },
      { n: 5, text: "Clique em **Salvar**." } ] } ] }],
  done: "A conta aparece na lista de Contas, com o saldo que você informou.",
  problems: ["**O saldo ficou errado?** Na lista, clique na conta e corrija o saldo."] }
```

## 4. Numbers, pictures and parts

- A **block** is one picture plus the steps it illustrates. Its picture shows the badges of exactly those steps (and its extras' letters).
- Numbers continue across the blocks of a part (1–2 on the first picture, 3 on the second, 4–9 on the form). A new part usually restarts at 1; a part may continue the previous numbering when it refers back to an earlier picture ("click **Review one by one** — number 6 on the first picture").
- A block without `image` gives text-only steps (useful for steps already shown elsewhere, or for a short variant).
- A block with an image and no steps shows the result (the last picture of a tutorial, with a label like "Your new task").
- Steps are integers; extras are capital letters. Extras are alternatives on the same screen, not next steps.

## 5. Screens, phone, FAQ, glossary, quick tasks

- **SCREENS** answers "what is this screen for?": one entry per main screen, a one-line `text`, and `parts` (numbered on the screen's picture) for its regions. Link to the tutorial that does the work there.
- **PHONE** (when the app is used on phones): how to install it as an app (iPhone: Safari → **Share** → **Add to Home Screen**; Android: Chrome → **Install app**), where things are on the phone layout, and one phone video of the most common task.
- **FAQ**: real questions in the user's words — from support messages, from concepts that confuse ("Does paying the card bill count as an expense?"), from limits ("Can I undo a deletion?"). Group by theme; answers of one to three sentences that link to the tutorial.
- **GLOSSARY**: every product term a user meets, in plain words ("Due date — the day a task must be done.").
- **QUICK**: the four to eight most common tasks, in short labels ("Add a task").

## 6. What `build.mjs` checks

Errors (✗): repeated or malformed ids, unknown groups, links to nothing, quick tasks to nothing, repeated video files, non-integer step numbers, extras that are not letters, a cited picture that does not exist, **a step number missing from its picture**. Warnings (!): steps out of order inside a part, a long step, missing alt text, a drawn number that no step explains, videos not recorded yet. Run `node scripts/help/lib/build.mjs --strict` before delivering.
