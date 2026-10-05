// Text of Tidy's help center: the page (lib/build.mjs) and the in-app help
// (lib/search.mjs) read it. Short sentences, one action per step, the exact
// name of each button or field in **bold**. The number of each step is the
// number drawn on its picture; letters mark optional extras.

export const GROUPS = [
  { id: "start", title: "First steps" },
  { id: "daily", title: "Day to day" },
  { id: "settings", title: "Your settings" },
];

export const TUTORIALS = [
  {
    id: "add-task", group: "start", title: "Add a task",
    summary: "Write down something you need to do, with a date.",
    keywords: "new task create add todo to-do reminder due date priority",
    video: { file: "01-add-task", title: "How to add a task" },
    parts: [
      { blocks: [
        { image: "add-task-1-button", alt: "Today screen with the New task button marked", steps: [
          { n: 1, text: "Click **+ New task**, at the top of the menu. It is on every screen." },
        ] },
        { image: "add-task-2-form", alt: "New task form filled in", steps: [
          { n: 2, text: "In **Title**, write what you need to do. Example: Pay the electricity bill." },
          { n: 3, text: "In **Project**, choose where the task belongs. Example: Home." },
          { n: 4, text: "In **Due date**, choose the day it must be done." },
          { n: 5, text: "In **Priority**, choose **Low**, **Normal** or **High**." },
          { n: 6, text: "Turn on **Remind me** to get a notice on the morning of that day." },
          { n: 7, text: "Click **Save**." },
        ], extras: [
          { n: "A", text: "**Notes** is optional: write any detail you want to remember." },
        ] },
        { image: "add-task-3-done", alt: "The new task in the Coming up list", steps: [] },
      ] },
    ],
    done: "The task appears in **Due today** or in **Coming up**, by its date.",
    problems: [
      "**Save does nothing?** The title is empty: a message in red asks you to write one.",
      "**Chose the wrong day?** Open the task and change it. See [Change or delete a task](#edit-task).",
    ],
  },
  {
    id: "edit-task", group: "daily", title: "Change or delete a task",
    summary: "Fix a title or a date, finish a task or remove it.",
    keywords: "edit change rename move date delete remove duplicate copy done finish complete check",
    parts: [
      { title: "Change a task", blocks: [
        { image: "edit-task-1-row", alt: "A task row with the three dots marked", steps: [
          { n: 1, text: "Find the task and click the **three dots (…)** at the end of its row." },
        ] },
        { image: "edit-task-2-menu", alt: "Menu with Edit, Duplicate and Delete", steps: [
          { n: 2, text: "Click **Edit**." },
        ], extras: [
          { n: "A", text: "**Duplicate** makes a copy of the task, with \"(copy)\" in the title." },
          { n: "B", text: "**Delete** removes the task right away." },
        ] },
        { image: "edit-task-3-form", alt: "Edit task form", steps: [
          { n: 3, text: "Change what you need and click **Save**." },
          { n: 4, text: "To remove the task, click **Delete**." },
        ] },
      ] },
      { title: "Mark a task as done", blocks: [
        { image: "edit-task-4-done", alt: "The box at the start of a task row", steps: [
          { n: 1, text: "Click the **box** at the start of the row. The title gets a line through it." },
        ] },
      ], note: "Clicked by mistake? Click the box again." },
    ],
    done: "Your changes show in the list right away.",
  },
  {
    id: "add-project", group: "start", title: "Create a project",
    summary: "Group tasks by what they are for: home, work, a trip.",
    keywords: "project folder group category list color new create",
    video: { file: "02-add-project", title: "How to create a project" },
    parts: [
      { blocks: [
        { image: "project-1-button", alt: "Projects screen with the Project button marked", steps: [
          { n: 1, text: "In the menu, click **Projects**." },
          { n: 2, text: "Click **+ Project**, at the top right." },
        ] },
        { image: "project-2-form", alt: "New project form", steps: [
          { n: 3, text: "In **Name**, write the name. Example: Garden." },
          { n: 4, text: "Choose a **color**. It marks the project's tasks." },
          { n: 5, text: "Click **Save**." },
        ] },
      ] },
    ],
    done: "The project appears in the list. Choose it in **Project** when you add a task.",
  },
  {
    id: "settings", group: "settings", title: "Change the theme and reminders",
    summary: "Light or dark, reminders on or off, and a copy of your data.",
    keywords: "settings theme dark light mode night reminders notifications export download backup copy",
    parts: [
      { blocks: [
        { image: "settings-1", alt: "Settings screen", steps: [
          { n: 1, text: "In the menu, click **Settings**." },
          { n: 2, text: "In **Theme**, choose **Light**, **Dark** or **System** (the same as your device)." },
          { n: 3, text: "Turn **Reminders** on or off." },
          { n: 4, text: "Click **Export** to download all your tasks and projects in a file." },
        ] },
      ] },
    ],
    done: "The changes are saved at once. There is no Save button on this screen.",
  },
];

export const SCREENS = [
  { name: "Today", image: "screen-today", text: "What to do today and in the next days.", parts: [
    "**Due today**: the tasks for today, and the late ones.",
    "**Coming up**: the tasks of the next days.",
    "**Search**: write part of a title to find a task.",
  ] },
];

export const PHONE = {
  video: { file: "09-phone-add-task", title: "On the phone: add a task" },
  install: [
    "**iPhone:** open Tidy in **Safari**. Tap **Share** (the square with an arrow) and then **Add to Home Screen**.",
    "**Android:** open Tidy in **Chrome**. Tap the **three dots** and then **Install app**.",
  ],
  blocks: [
    { image: "phone-1-bar", alt: "Bottom bar on the phone", steps: [
      { n: 1, text: "**Today**: the tasks for today and the next days." },
      { n: 2, text: "**Projects**: your projects." },
      { n: 3, text: "**+**: add a task." },
      { n: 4, text: "**Settings**: theme, reminders and export." },
    ] },
    { image: "phone-2-form", alt: "New task form on the phone", steps: [
      { n: 1, text: "Fill in the task as on the computer and tap **Save**." },
    ] },
  ],
};

export const FAQ = [
  { title: "Tasks", items: [
    ["Can I undo a deletion?", "No. **Delete** removes the task right away. To keep a task out of the way, mark it as done instead."],
    ["What does \"3 days late\" mean?", "The task's due date has passed and it is not done yet. Late tasks stay in **Due today** until you finish them."],
    ["How do I find an old task?", "Write part of its title in **Search tasks**, at the top of the screen."],
  ] },
  { title: "Your data", items: [
    ["How do I keep a copy of my tasks?", "In **Settings**, click **Export**. Tidy downloads a file with all your tasks and projects."],
    ["What does the sync button do?", "The round arrows at the top check that everything is up to date. A message says when it is done."],
  ] },
];

export const GLOSSARY = [
  ["Task", "Something you need to do, with a title and a date."],
  ["Project", "A group of tasks, like Home or Work, with its own color."],
  ["Due date", "The day a task must be done."],
  ["Priority", "How important a task is: low, normal or high."],
  ["Reminder", "A notice on the morning a task is due."],
];

export const QUICK = [
  ["add-task", "Add a task"],
  ["edit-task", "Change or delete a task"],
  ["add-project", "Create a project"],
  ["settings", "Change the theme"],
];
