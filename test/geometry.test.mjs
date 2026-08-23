import assert from "node:assert/strict";
import test from "node:test";

class FakeClassList {
  values = new Set();

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  [Symbol.iterator]() {
    return this.values[Symbol.iterator]();
  }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.className = "";
    this.classList = new FakeClassList();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
  }

  get clientLeft() {
    return this.classList.values.has("cr-viewport") ? 2 : 0;
  }

  get clientTop() {
    return this.clientLeft;
  }

  get clientWidth() {
    return this.naturalWidth || Number.parseFloat(this.style.width) || 0;
  }

  get clientHeight() {
    return this.naturalHeight || Number.parseFloat(this.style.height) || 0;
  }

  get offsetWidth() {
    return this.clientWidth + this.clientLeft * 2;
  }

  get offsetHeight() {
    return this.clientHeight + this.clientTop * 2;
  }

  get offsetLeft() {
    if (this.classList.values.has("cr-viewport")) {
      return (this.parentNode.clientWidth - this.offsetWidth) / 2;
    }
    return Number.parseFloat(this.style.left) || 0;
  }

  get offsetTop() {
    if (this.classList.values.has("cr-viewport")) {
      return (this.parentNode.clientHeight - this.offsetHeight) / 2;
    }
    return Number.parseFloat(this.style.top) || 0;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children.splice(this.children.indexOf(child), 1);
    child.parentNode = null;
  }

  replaceChild(next, previous) {
    const index = this.children.indexOf(previous);
    this.children[index] = next;
    previous.parentNode = null;
    next.parentNode = this;
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  removeAttribute(name) {
    delete this[name];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
    );
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) ?? []) listener.call(this, event);
    return true;
  }

  getBoundingClientRect() {
    throw new Error("crop initialization must not read transformed client geometry");
  }
}

class FakeImage extends FakeElement {
  constructor() {
    super("img");
    this.naturalWidth = 1000;
    this.naturalHeight = 500;
    this.width = 1000;
    this.height = 500;
  }

  set src(value) {
    this.currentSource = value;
    queueMicrotask(() => this.onload?.());
  }
}

const document = {
  body: new FakeElement("body"),
  createElement: (tagName) => (tagName === "img" ? new FakeImage() : new FakeElement(tagName)),
  createEvent: (type) => ({
    type,
    initEvent(nextType) {
      this.type = nextType;
    },
    initCustomEvent(nextType) {
      this.type = nextType;
    },
  }),
};

globalThis.document = document;
globalThis.window = {
  document,
  CustomEvent: class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  },
  addEventListener() {},
  removeEventListener() {},
};
globalThis.CustomEvent = window.CustomEvent;
globalThis.Image = FakeImage;

const { default: CroppieCore } = await import("../dist/croppie-core.mjs");

test("binding is independent of an ancestor's in-flight transform", async () => {
  const host = new FakeElement();
  const cropper = new CroppieCore(host, {
    boundary: { width: 400, height: 300 },
    viewport: { width: 280, height: 280, type: "square" },
    maxZoom: 2,
    showZoomer: false,
  });

  await cropper.bind({ url: "blob:test", zoom: 0 });

  assert.deepEqual(cropper.get().points, ["250", "0", "750", "500"]);
  cropper.destroy();
});
