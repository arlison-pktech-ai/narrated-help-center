// Text of the help center: the page (lib/build.mjs), the in-app help and an
// assistant's answers (lib/search.mjs) all read it. Plain words for people who
// are not technical: short sentences, one action per step, the exact name of
// each button or field in **bold**. The number of each step is the number
// drawn on its picture (stills.spec.mjs); letters (A, B) mark optional extras.
// Only **bold** and [text](url) formatting; [text](#id) links to another
// tutorial or to #faq, #glossary, #screens, #phone. `keywords` are the other
// words people use for the task, so the search finds it.
// Plain data only: no imports, so the app and the build can both load it.

export const GROUPS = [
  { id: "start", title: "First steps" },
  { id: "daily", title: "Day to day" },
  { id: "more", title: "Going further" },
];

export const TUTORIALS = [
  {
    id: "add-item",                 // TODO: one tutorial per task people do; the id becomes #add-item
    group: "start",
    title: "Add an item",           // a task, verb first
    summary: "Write down something new in a few seconds.",
    keywords: "new create add item record write",
    video: { file: "01-add-item", title: "How to add an item" },
    before: ["Have the **name** of the item at hand."],
    parts: [
      { blocks: [
        { image: "add-item-1-button", alt: "Items screen with the New item button marked", steps: [
          { n: 1, text: "In the menu, click **Items**." },
          { n: 2, text: "Click **+ New item**, at the top right." },
        ] },
        { image: "add-item-2-form", alt: "New item form filled in", steps: [
          { n: 3, text: "In **Name**, write what it is. Example: Garden hose." },
          { n: 4, text: "Click **Save**." },
        ], extras: [
          { n: "A", text: "**Save and add another** keeps the form open for the next one." },
        ] },
        { image: "add-item-3-done", alt: "The new item at the top of the list", steps: [] },
      ] },
    ],
    done: "The item appears at the top of the list.",
    problems: [
      "**The Save button does nothing?** A required field is empty: it shows a short message in red.",
    ],
  },
];

// Optional: what each screen is for. `parts` are numbered on the picture.
export const SCREENS = [
  // { name: "Items", image: "screen-items", text: "Everything you wrote down.", parts: ["**Search**: …", "**Filters**: …"] },
];

// Optional: the phone section (install as an app and where things are).
export const PHONE = null;
// export const PHONE = {
//   video: { file: "09-phone-add-item", title: "On the phone: add an item" },
//   install: ["**iPhone:** open the app in **Safari**, tap **Share** and then **Add to Home Screen**.", "**Android:** open it in **Chrome** and tap **Install app**."],
//   blocks: [{ image: "phone-1-bar", alt: "Bottom bar on the phone", steps: [{ n: 1, text: "**Items**: everything you wrote down." }] }],
// };

export const FAQ = [
  { title: "Items", items: [
    ["Can I undo a deletion?", "No. Before deleting, the app asks you to confirm."],
  ] },
];

export const GLOSSARY = [
  ["Item", "Anything you write down in the app."],
];

// "What do you want to do?" on the top of the page: [tutorial id, short label].
export const QUICK = [
  ["add-item", "Add an item"],
];
