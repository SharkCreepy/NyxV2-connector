// Quick Node regression test for providers/claude.js (run: node test-claude.js).
const fs = require("fs");
const assert = require("assert");

const attrs = {};
const editor = {
  nodeType: 1,
  isConnected: true,
  innerText: "",
  childNodes: [],
  disabled: false,
  get textContent() { return this.innerText; },
  set textContent(value) { this.innerText = String(value); },
  focus() {},
  closest(selector) { return selector === "form" ? form : null; },
  matches() { return false; },
  setAttribute(name, value) { attrs[name] = String(value); },
  getAttribute(name) { return attrs[name] ?? null; },
  getClientRects() { return [{ width: 300, height: 40 }]; },
  dispatchEvent(event) {
    if (event.type === "input" && event.data) this.textContent = event.data;
  },
};
let formSubmits = 0;
const form = {
  querySelectorAll() { return []; },
  requestSubmit() {
    formSubmits++;
    editor.textContent = "";
  },
};
let sendControl = null;
const button = {
  isConnected: true,
  disabled: false,
  getAttribute(name) { return name === "aria-label" ? "Send prompt" : null; },
  closest() { return null; },
  getClientRects() { return [{ width: 32, height: 32 }]; },
  click() { editor.textContent = ""; },
};

global.window = {
  getSelection() { return { removeAllRanges() {}, addRange() {} }; },
};
global.InputEvent = class {
  constructor(type, options) { this.type = type; Object.assign(this, options); }
};
global.KeyboardEvent = class {
  constructor(type, options) { this.type = type; Object.assign(this, options); }
};
global.document = {
  createRange() { return { selectNodeContents() {} }; },
  execCommand() { return false; },
  querySelectorAll(selector) {
    if (selector.includes("contenteditable")) return [editor];
    if (selector.includes('aria-label*="send" i') && sendControl) return [button];
    return [];
  },
};
global.location = { pathname: "/new" };

const provider = new Function(
  fs.readFileSync(__dirname + "/providers/claude.js", "utf8") + "; return ZSProvider;"
)();

(async () => {
  provider.timings.SEND_BUTTON_TIMEOUT_MS = 1;
  provider.setInputLock(true);
  await provider.typeAndSend("startup prompt");
  assert.strictEqual(formSubmits, 1, "Claude form submit is used when no enabled send button appears");
  assert.strictEqual(editor.innerText, "", "fallback submission is confirmed by the cleared composer");

  provider.setInputLock(false);
  provider.setInputLock(true);
  sendControl = true;
  await provider.typeAndSend("second prompt");
  assert.strictEqual(editor.innerText, "", "expanded case-insensitive Send selector clicks Claude's control");
  assert.strictEqual(formSubmits, 1, "form fallback is not used when the Send control is available");

  console.log("PASS Claude startup submits through the composer form when Send is unavailable");
  console.log("PASS case-insensitive Claude Send controls are detected and clicked");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
