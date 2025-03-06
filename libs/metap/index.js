import { metaP } from "./metap.js";

const commands = [
  {
    title: "Open Settings",
    aliases: ["preferences", "configuration"],
    lambda: () => {
      console.log("Opening Settings...");
    },
  },
  {
    title: "Create New Document",
    aliases: ["new file", "make document"],
    lambda: () => {
      console.log("Creating new document...");
    },
  },
  {
    title: "Save Current File",
    aliases: ["save", "export", "backup", "persist"],
    lambda: () => {
      console.log("Saving file...");
    },
  },
  {
    title: "Export as PDF",
    lambda: () => {
      console.log("Exporting to PDF...");
    },
  },
  {
    title:
      "This is an extremely long command title to demonstrate the ellipsis and tooltip feature", // Very long title
    lambda: () => {
      console.log("Executing extremely long command...");
    }, // Simple lambda
  },
  {
    title: "Print Document",
    lambda: () => {
      console.log("Printing document...");
    },
  },
  {
    title: "Undo Last Action",
    lambda: () => {
      console.log("Undoing last action...");
    },
  },
  {
    title: "Redo Action",
    lambda: () => {
      console.log("Redoing action...");
    },
  },
  {
    title: "Zoom In",
    lambda: () => {
      console.log("Zooming in...");
    },
  },
  {
    title: "Zoom Out",
    lambda: () => {
      console.log("Zooming out...");
    },
  },
  {
    title: "Reset Zoom",
    lambda: () => {
      console.log("Resetting zoom...");
    },
  },
  {
    title: "Toggle Full Screen",
    lambda: () => {
      console.log("Toggling full screen...");
    },
  },
  {
    title: "Check for Updates",
    lambda: () => {
      console.log("Checking for updates...");
    },
  },
  {
    title: "About Application",
    lambda: () => {
      console.log("Showing about info...");
    },
  },
  {
    title: "Find in Document",
    inputs: [{ title: "Search for" }],
    lambda: (term) => {
      console.log(`Finding "${term}"...`);
    },
  },
  {
    title: "Replace in Document",
    inputs: [
      { title: "Find", default: "text to find" },
      { title: "Replace with" },
    ],
    lambda: (find, replace) => {
      console.log(`Replacing "${find}" with "${replace}"...`);
    },
  },
  {
    title: "Insert Date",
    lambda: () => {
      console.log("Inserting current date...");
    },
  },
  {
    title: "Insert Time",
    lambda: () => {
      console.log("Inserting current time...");
    },
  },
  {
    title: "Count Words",
    lambda: () => {
      console.log("Counting words in document...");
    },
  },
  {
    title: "Format Document",
    lambda: () => {
      console.log("Formatting document...");
    },
  },
  {
    title: "Run Spell Check",
    lambda: () => {
      console.log("Running spell check...");
    },
  },
  {
    title: "Show Developer Tools",
    lambda: () => {
      console.log("Showing developer tools...");
    },
  },
  {
    title: "Restart Application",
    lambda: () => {
      console.log("Restarting application...");
    },
  },
  {
    title: "Exit Application",
    lambda: () => {
      console.log("Exiting application...");
    },
  },
  {
    title: "Clear Cache",
    lambda: () => {
      console.log("Clearing cache...");
    },
  },
];

metaP.bind(commands, { sepia: 30 });
