// View-only: visitors can read, click and use the forms, but not select, copy, drag images out,
// open the context menu or print the page. Inputs (the Terminal, Jarvis, the contact form) still
// accept typing and paste. This deters casual copying; it cannot stop a screenshot or someone
// reading the page source, which no public website can prevent.

const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

function inEditable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE) !== null;
}

export function protectContent(doc: Document = document): void {
  doc.documentElement.classList.add("view-only");
  const block = (e: Event) => {
    if (!inEditable(e.target)) e.preventDefault();
  };
  for (const type of ["copy", "cut", "contextmenu", "selectstart", "dragstart"]) {
    doc.addEventListener(type, block, { capture: true });
  }
  doc.addEventListener(
    "keydown",
    (e) => {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (key === "p" || key === "s")) e.preventDefault(); // print, save page
      if (mod && (key === "c" || key === "x" || key === "a") && !inEditable(e.target)) e.preventDefault();
    },
    { capture: true },
  );
}
