// Quick Node regression test for providers/claude.js (run: node test-claude.js).
const fs = require("fs");
const assert = require("assert");

class StubTextArea {}
Object.defineProperty(StubTextArea.prototype, "value", {
  get() { return this._value || ""; },
  set(value) { this._value = String(value); },
});
const attrs = { "data-testid": "static-composer-input", "aria-label": "Write your prompt to Claude" };
const editor = Object.assign(new StubTextArea(), {
  tagName: "TEXTAREA",
  isConnected: true,
  disabled: false,
  childNodes: [],
  inputEvents: 0,
  focus() {},
  closest(selector) { return selector === "form" ? form : null; },
  matches() { return false; },
  setAttribute(name, value) { attrs[name] = String(value); },
  removeAttribute(name) { delete attrs[name]; },
  getAttribute(name) { return attrs[name] ?? null; },
  getClientRects() { return [{ width: 300, height: 40 }]; },
  dispatchEvent(event) {
    if (event.type === "input") this.inputEvents++;
  },
});
let formSubmits = 0;
const form = {
  querySelectorAll() { return []; },
  requestSubmit() {
    formSubmits++;
    editor.value = "";
  },
};
let sendControl = false;
const button = {
  isConnected: true,
  disabled: false,
  getAttribute(name) { return name === "aria-label" ? "Send prompt" : null; },
  closest() { return null; },
  getClientRects() { return [{ width: 32, height: 32 }]; },
  click() { editor.value = ""; },
};

global.window = { HTMLTextAreaElement: StubTextArea };
global.HTMLTextAreaElement = StubTextArea;
global.InputEvent = class {
  constructor(type, options) { this.type = type; Object.assign(this, options); }
};
global.KeyboardEvent = class {
  constructor(type, options) { this.type = type; Object.assign(this, options); }
};
global.document = {
  querySelectorAll(selector) {
    if (selector.includes('textarea[data-testid="static-composer-input"]')) return [editor];
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
  assert.strictEqual(editor.getAttribute("readonly"), "", "textarea composer is locked with readonly");
  assert.strictEqual(provider.getEditor(), editor, "Claude static-composer-input textarea is detected");

  await provider.typeAndSend("startup prompt");
  assert.strictEqual(editor.inputEvents, 1, "prompt insertion dispatches an input event for React");
  assert.strictEqual(formSubmits, 1, "Claude form submit is used when no enabled send button appears");
  assert.strictEqual(editor.value, "", "fallback submission is confirmed by the cleared composer");
  assert.strictEqual(editor.getAttribute("readonly"), "", "textarea is relocked after prompt insertion");

  provider.setInputLock(false);
  provider.setInputLock(true);
  sendControl = true;
  await provider.typeAndSend("second prompt");
  assert.strictEqual(editor.value, "", "case-insensitive Send selector clicks Claude's control");
  assert.strictEqual(formSubmits, 1, "form fallback is not used when the Send control is available");

  console.log("PASS Claude static composer textarea is detected, written, and locked correctly");
  console.log("PASS Claude startup submits through the composer form when Send is unavailable");
  console.log("PASS case-insensitive Claude Send controls are detected and clicked");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
