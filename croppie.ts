/*************************
 * Croppie
 * Copyright 2019
 * Foliotek
 * Version: 2.6.5
 *************************/

// Type definitions
interface CroppieOptions {
  viewport?: {
    width?: number;
    height?: number;
    type?: "square" | "circle";
  };
  boundary?: {
    width?: number;
    height?: number;
  };
  orientationControls?: {
    enabled?: boolean;
    leftClass?: string;
    rightClass?: string;
  };
  resizeControls?: {
    width?: boolean;
    height?: boolean;
  };
  customClass?: string;
  showZoomer?: boolean;
  enableZoom?: boolean;
  enableResize?: boolean;
  mouseWheelZoom?: boolean | "ctrl";
  enableExif?: boolean;
  enforceBoundary?: boolean;
  enableOrientation?: boolean;
  enableKeyMovement?: boolean;
  useCanvas?: boolean;
  url?: string;
  points?: number[];
  zoom?: number;
  orientation?: number;
  relative?: boolean;
  minZoom?: number;
  maxZoom?: number;
  update?: (data: CroppieResult) => void;
}

interface CroppieBindOptions {
  url?: string;
  points?: number[];
  zoom?: number;
  orientation?: number;
}

interface CroppieResult {
  points: string[];
  zoom: number;
  orientation: number;
}

interface CroppieResultOptions {
  type?: "base64" | "html" | "blob" | "rawcanvas" | "canvas" | "points";
  size?: "viewport" | "original" | { width?: number; height?: number };
  format?: "jpeg" | "png" | "webp";
  quality?: number;
  circle?: boolean;
  backgroundColor?: string;
}

interface CroppieElements {
  boundary: HTMLElement;
  viewport: HTMLElement;
  img: HTMLImageElement;
  overlay: HTMLElement;
  preview: HTMLElement | HTMLCanvasElement;
  canvas?: HTMLCanvasElement;
  zoomer?: HTMLInputElement;
  zoomerWrap?: HTMLElement;
  orientationBtnLeft?: HTMLButtonElement;
  orientationBtnRight?: HTMLButtonElement;
}

interface CroppieData {
  bound?: boolean;
  url?: string;
  boundZoom?: number | null;
  points?: number[];
  orientation?: number;
}

const EXIF_NORM: number[] = [1, 8, 3, 6];
const EXIF_FLIP: number[] = [2, 7, 4, 5];

const CSS_TRANSFORM = "transform";
const CSS_TRANS_ORG = "transformOrigin";
const CSS_USERSELECT = "userSelect";

const getExifOffset = (ornt: number, rotate: number): number => {
  const arr = EXIF_NORM.indexOf(ornt) > -1 ? EXIF_NORM : EXIF_FLIP;
  const index = arr.indexOf(ornt);
  const offset = (rotate / 90) % arr.length;

  return arr[(arr.length + index + (offset % arr.length)) % arr.length];
};

const deepExtend = (destination: any = {}, source: any): any => {
  for (const property in source) {
    if (
      source[property] &&
      source[property].constructor &&
      source[property].constructor === Object
    ) {
      destination[property] = destination[property] || {};
      deepExtend(destination[property], source[property]);
    } else {
      destination[property] = source[property];
    }
  }
  return destination;
};

const clone = <T>(object: T): T => deepExtend({}, object);

const debounce = <F extends (...args: any[]) => any>(
  func: F,
  wait: number,
  immediate?: boolean
) => {
  let timeout: ReturnType<typeof setTimeout> | null;
  return function (this: any, ...args: Parameters<F>) {
    const context = this;
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

const dispatchChange = (element: HTMLElement): void => {
  const evt = document.createEvent("HTMLEvents");
  evt.initEvent("change", false, true);
  element.dispatchEvent(evt);
};

const css = (el: HTMLElement, styles: string | Record<string, string>, val?: string): void => {
  if (typeof styles === "string") {
    const tmp = styles;
    styles = {};
    styles[tmp] = val!;
  }

  for (const prop in styles) {
    (el.style as any)[prop] = styles[prop];
  }
};

const addClass = (el: HTMLElement, c: string): void => el.classList.add(c);

const removeClass = (el: HTMLElement, c: string): void => el.classList.remove(c);

const setAttributes = (el: HTMLElement, attrs: Record<string, string>): void => {
  for (const key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
};

const num = (v: string | number): number => parseInt(v as string, 10);

/* Utilities */
const loadImage = (src: string, doExif?: boolean): Promise<HTMLImageElement> => {
  if (!src) {
    throw "Source image missing";
  }

  const img = new Image();
  img.style.opacity = "0";
  return new Promise((resolve, reject) => {
    const _resolve = () => {
      img.style.opacity = "1";
      setTimeout(() => resolve(img), 1);
    };

    img.removeAttribute("crossOrigin");
    if (src.match(/^https?:\/\/|^\/\//)) {
      img.setAttribute("crossOrigin", "anonymous");
    }

    img.onload = () => {
      if (doExif) {
        EXIF.getData(img, () => _resolve());
      } else {
        _resolve();
      }
    };
    img.onerror = (ev) => {
      img.style.opacity = 1;
      setTimeout(() => reject(ev), 1);
    };
    img.src = src;
  });
};

interface ImageDimensions {
  width: number;
  height: number;
}

const naturalImageDimensions = (img: HTMLImageElement, ornt?: number): ImageDimensions => {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const orient = ornt || getExifOrientation(img);
  if (orient && orient >= 5) {
    [w, h] = [h, w];
  }
  return { width: w, height: h };
};

/* CSS Transform Class */
const TRANSLATE_OPTS: Record<string, { suffix: string }> = {
  translate3d: {
    suffix: ", 0px",
  },
  translate: {
    suffix: "",
  },
};

class Transform {
  x: number;
  y: number;
  scale: number;

  constructor(x: number | string, y: number | string, scale: number | string) {
    this.x = parseFloat(x as string);
    this.y = parseFloat(y as string);
    this.scale = parseFloat(scale as string);
  }

  static parse(v: any): Transform {
    if (v.style) {
      return Transform.parse(v.style[CSS_TRANSFORM]);
    } else if (v.indexOf("matrix") > -1 || v.indexOf("none") > -1) {
      return Transform.fromMatrix(v);
    } else {
      return Transform.fromString(v);
    }
  }

  static fromMatrix(v: string): Transform {
    const vals = v.substring(7).split(",");
    if (!vals.length || v === "none") {
      return new Transform(0, 0, 1);
    }
    return new Transform(num(vals[4]), num(vals[5]), parseFloat(vals[0]));
  }

  static fromString(v: string): Transform {
    const values = v.split(") ");
    const translate = values[0].substring((Croppie as any).globals.translate.length + 1).split(",");
    const scale = values.length > 1 ? values[1].substring(6) : "1";
    const x = translate.length > 1 ? translate[0] : "0";
    const y = translate.length > 1 ? translate[1] : "0";
    return new Transform(x, y, scale);
  }

  toString(): string {
    const suffix = TRANSLATE_OPTS[(Croppie as any).globals.translate]?.suffix || "";
    return `${(Croppie as any).globals.translate}(${this.x}px, ${this.y}px${suffix}) scale(${
      this.scale
    })`;
  }
}

class TransformOrigin {
  x: number;
  y: number;

  constructor(el?: HTMLElement) {
    if (!el || !el.style[CSS_TRANS_ORG]) {
      this.x = 0;
      this.y = 0;
      return;
    }
    const cssValues = el.style[CSS_TRANS_ORG].split(" ");
    this.x = parseFloat(cssValues[0]);
    this.y = parseFloat(cssValues[1]);
  }

  toString(): string {
    return `${this.x}px ${this.y}px`;
  }
}

interface ExifData {
  Orientation?: number;
}

interface ExifImage extends HTMLImageElement {
  exifdata?: ExifData;
}

const getExifOrientation = (img: ExifImage): number => {
  return img.exifdata?.Orientation ? num(img.exifdata.Orientation) : 1;
};

const drawCanvas = (canvas, img, orientation) => {
  const width = img.width;
  const height = img.height;
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;

  ctx.save();
  switch (orientation) {
    case 2:
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;

    case 3:
      ctx.translate(width, height);
      ctx.rotate((180 * Math.PI) / 180);
      break;

    case 4:
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;

    case 5:
      canvas.width = height;
      canvas.height = width;
      ctx.rotate((90 * Math.PI) / 180);
      ctx.scale(1, -1);
      break;

    case 6:
      canvas.width = height;
      canvas.height = width;
      ctx.rotate((90 * Math.PI) / 180);
      ctx.translate(0, -height);
      break;

    case 7:
      canvas.width = height;
      canvas.height = width;
      ctx.rotate((-90 * Math.PI) / 180);
      ctx.translate(-width, height);
      ctx.scale(1, -1);
      break;

    case 8:
      canvas.width = height;
      canvas.height = width;
      ctx.translate(0, width);
      ctx.rotate((-90 * Math.PI) / 180);
      break;
  }
  ctx.drawImage(img, 0, 0, width, height);
  ctx.restore();
};

/* Private Methods */
function _create() {
  const self = this;
  const contClass = "croppie-container";
  const customViewportClass = self.options.viewport.type
    ? `cr-vp-${self.options.viewport.type}`
    : null;

  self.options.useCanvas = self.options.enableOrientation || _hasExif.call(self);
  // Properties on class
  self.data = {};
  self.elements = {};

  const boundary = (self.elements.boundary = document.createElement("div"));
  const viewport = (self.elements.viewport = document.createElement("div"));
  const img = (self.elements.img = document.createElement("img"));
  img.setAttribute("crossOrigin", "anonymous");
  const overlay = (self.elements.overlay = document.createElement("div"));

  if (self.options.useCanvas) {
    self.elements.canvas = document.createElement("canvas");
    self.elements.preview = self.elements.canvas;
  } else {
    self.elements.preview = img;
  }

  addClass(boundary, "cr-boundary");
  boundary.setAttribute("aria-dropeffect", "none");
  const bw = self.options.boundary.width;
  const bh = self.options.boundary.height;
  css(boundary, {
    width: `${bw}${isNaN(bw) ? "" : "px"}`,
    height: `${bh}${isNaN(bh) ? "" : "px"}`,
  });

  addClass(viewport, "cr-viewport");
  if (customViewportClass) {
    addClass(viewport, customViewportClass);
  }
  css(viewport, {
    width: `${self.options.viewport.width}px`,
    height: `${self.options.viewport.height}px`,
  });
  viewport.setAttribute("tabindex", 0);

  addClass(self.elements.preview, "cr-image");
  setAttributes(self.elements.preview, { alt: "preview", "aria-grabbed": "false" });
  addClass(overlay, "cr-overlay");

  self.element.appendChild(boundary);
  boundary.appendChild(self.elements.preview);
  boundary.appendChild(viewport);
  boundary.appendChild(overlay);

  addClass(self.element, contClass);
  if (self.options.customClass) {
    addClass(self.element, self.options.customClass);
  }

  _initDraggable.call(this);

  if (self.options.enableZoom) {
    _initializeZoom.call(self);
  }

  if (self.options.enableOrientation) {
    _initRotationControls.call(self);
  }

  if (self.options.enableResize) {
    _initializeResize.call(self);
  }
}

function _initRotationControls() {
  const self = this;
  let wrap, btnLeft, btnRight, iLeft, iRight;

  wrap = document.createElement("div");
  self.elements.orientationBtnLeft = btnLeft = document.createElement("button");
  self.elements.orientationBtnRight = btnRight = document.createElement("button");

  wrap.appendChild(btnLeft);
  wrap.appendChild(btnRight);

  iLeft = document.createElement("i");
  iRight = document.createElement("i");
  btnLeft.appendChild(iLeft);
  btnRight.appendChild(iRight);

  addClass(wrap, "cr-rotate-controls");
  addClass(btnLeft, "cr-rotate-l");
  addClass(btnRight, "cr-rotate-r");

  self.elements.boundary.appendChild(wrap);

  btnLeft.addEventListener("click", () => {
    self.rotate(-90);
  });
  btnRight.addEventListener("click", () => {
    self.rotate(90);
  });
}

function _hasExif() {
  return this.options.enableExif && window.EXIF;
}

function _initializeResize() {
  const self = this;
  const wrap = document.createElement("div");
  let isDragging = false;
  let direction;
  let originalX;
  let originalY;
  const minSize = 50;
  let maxWidth;
  let maxHeight;
  let vr;
  let hr;

  addClass(wrap, "cr-resizer");
  css(wrap, {
    width: `${this.options.viewport.width}px`,
    height: `${this.options.viewport.height}px`,
  });

  if (this.options.resizeControls.height) {
    vr = document.createElement("div");
    addClass(vr, "cr-resizer-vertical");
    wrap.appendChild(vr);
  }

  if (this.options.resizeControls.width) {
    hr = document.createElement("div");
    addClass(hr, "cr-resizer-horisontal");
    wrap.appendChild(hr);
  }

  const mouseDown = (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;

    ev.preventDefault();
    if (isDragging) {
      return;
    }

    const overlayRect = self.elements.overlay.getBoundingClientRect();

    isDragging = true;
    originalX = ev.pageX;
    originalY = ev.pageY;
    direction = ev.currentTarget.className.indexOf("vertical") !== -1 ? "v" : "h";
    maxWidth = overlayRect.width;
    maxHeight = overlayRect.height;

    if (ev.touches) {
      const touches = ev.touches[0];
      originalX = touches.pageX;
      originalY = touches.pageY;
    }

    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("touchmove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    window.addEventListener("touchend", mouseUp);
    document.body.style[CSS_USERSELECT] = "none";
  };

  const mouseMove = (ev) => {
    let pageX = ev.pageX;
    let pageY = ev.pageY;

    ev.preventDefault();

    if (ev.touches) {
      const touches = ev.touches[0];
      pageX = touches.pageX;
      pageY = touches.pageY;
    }

    const deltaX = pageX - originalX;
    const deltaY = pageY - originalY;
    const newHeight = self.options.viewport.height + deltaY;
    const newWidth = self.options.viewport.width + deltaX;

    if (direction === "v" && newHeight >= minSize && newHeight <= maxHeight) {
      css(wrap, {
        height: `${newHeight}px`,
      });

      self.options.boundary.height += deltaY;
      css(self.elements.boundary, {
        height: `${self.options.boundary.height}px`,
      });

      self.options.viewport.height += deltaY;
      css(self.elements.viewport, {
        height: `${self.options.viewport.height}px`,
      });
    } else if (direction === "h" && newWidth >= minSize && newWidth <= maxWidth) {
      css(wrap, {
        width: `${newWidth}px`,
      });

      self.options.boundary.width += deltaX;
      css(self.elements.boundary, {
        width: `${self.options.boundary.width}px`,
      });

      self.options.viewport.width += deltaX;
      css(self.elements.viewport, {
        width: `${self.options.viewport.width}px`,
      });
    }

    _updateOverlay.call(self);
    _updateZoomLimits.call(self);
    _updateCenterPoint.call(self);
    _triggerUpdate.call(self);
    originalY = pageY;
    originalX = pageX;
  };

  const mouseUp = () => {
    isDragging = false;
    window.removeEventListener("mousemove", mouseMove);
    window.removeEventListener("touchmove", mouseMove);
    window.removeEventListener("mouseup", mouseUp);
    window.removeEventListener("touchend", mouseUp);
    document.body.style[CSS_USERSELECT] = "";
  };

  if (vr) {
    vr.addEventListener("mousedown", mouseDown);
    vr.addEventListener("touchstart", mouseDown);
  }

  if (hr) {
    hr.addEventListener("mousedown", mouseDown);
    hr.addEventListener("touchstart", mouseDown);
  }

  this.elements.boundary.appendChild(wrap);
}

function _setZoomerVal(v) {
  if (this.options.enableZoom) {
    const z = this.elements.zoomer;
    const val = fix(v, 4);
    z.value = Math.max(parseFloat(z.min), Math.min(parseFloat(z.max), val)).toString();
  }
}

function _initializeZoom() {
  const self = this;
  const wrap = (self.elements.zoomerWrap = document.createElement("div"));
  const zoomer = (self.elements.zoomer = document.createElement("input"));

  addClass(wrap, "cr-slider-wrap");
  addClass(zoomer, "cr-slider");
  zoomer.type = "range";
  zoomer.step = "0.0001";
  zoomer.value = "1";
  zoomer.style.display = self.options.showZoomer ? "" : "none";
  zoomer.setAttribute("aria-label", "zoom");

  self.element.appendChild(wrap);
  wrap.appendChild(zoomer);

  self._currentZoom = 1;

  const change = () => {
    _onZoom.call(self, {
      value: parseFloat(zoomer.value),
      origin: new TransformOrigin(self.elements.preview),
      viewportRect: self.elements.viewport.getBoundingClientRect(),
      transform: Transform.parse(self.elements.preview),
    });
  };

  const scroll = (ev) => {
    let delta, targetZoom;

    if (self.options.mouseWheelZoom === "ctrl" && ev.ctrlKey !== true) {
      return 0;
    } else if (ev.wheelDelta) {
      delta = ev.wheelDelta / 1200; //wheelDelta min: -120 max: 120 // max x 10 x 2
    } else if (ev.deltaY) {
      delta = ev.deltaY / 1060; //deltaY min: -53 max: 53 // max x 10 x 2
    } else if (ev.detail) {
      delta = ev.detail / -60; //delta min: -3 max: 3 // max x 10 x 2
    } else {
      delta = 0;
    }

    if (ev.isCustom) {
      _setZoomerVal.call(self, targetZoom);
      return change.call(self);
    }

    targetZoom = self._currentZoom + delta * self._currentZoom;

    ev.preventDefault();
    _setZoomerVal.call(self, targetZoom);
    change.call(self);
  };

  self.elements.zoomer.addEventListener("input", change); // this is being fired twice on keypress
  self.elements.zoomer.addEventListener("change", change);

  if (self.options.mouseWheelZoom) {
    self.elements.boundary.addEventListener("mousewheel", scroll);
    self.elements.boundary.addEventListener("DOMMouseScroll", scroll);
  }
}

function _onZoom(ui) {
  const self = this;
  const transform = ui ? ui.transform : Transform.parse(self.elements.preview);
  const vpRect = ui ? ui.viewportRect : self.elements.viewport.getBoundingClientRect();
  const origin = ui ? ui.origin : new TransformOrigin(self.elements.preview);

  const applyCss = () => {
    const transCss: Record<string, string> = {};
    transCss[CSS_TRANSFORM] = transform.toString();
    transCss[CSS_TRANS_ORG] = origin.toString();
    css(self.elements.preview, transCss);
  };

  self._currentZoom = ui ? ui.value : self._currentZoom;
  transform.scale = self._currentZoom;
  self.elements.zoomer.setAttribute("aria-valuenow", self._currentZoom);
  applyCss();

  if (self.options.enforceBoundary) {
    const boundaries = _getVirtualBoundaries.call(self, vpRect);
    const transBoundaries = boundaries.translate;
    const oBoundaries = boundaries.origin;

    if (transform.x >= transBoundaries.maxX) {
      origin.x = oBoundaries.minX;
      transform.x = transBoundaries.maxX;
    }

    if (transform.x <= transBoundaries.minX) {
      origin.x = oBoundaries.maxX;
      transform.x = transBoundaries.minX;
    }

    if (transform.y >= transBoundaries.maxY) {
      origin.y = oBoundaries.minY;
      transform.y = transBoundaries.maxY;
    }

    if (transform.y <= transBoundaries.minY) {
      origin.y = oBoundaries.maxY;
      transform.y = transBoundaries.minY;
    }
  }
  applyCss();
  _debouncedOverlay.call(self);
  _triggerUpdate.call(self);
}

function _getVirtualBoundaries(viewport) {
  const self = this;
  const scale = self._currentZoom;
  const vpWidth = viewport.width;
  const vpHeight = viewport.height;
  const centerFromBoundaryX = self.elements.boundary.clientWidth / 2;
  const centerFromBoundaryY = self.elements.boundary.clientHeight / 2;
  const imgRect = self.elements.preview.getBoundingClientRect();
  const curImgWidth = imgRect.width;
  const curImgHeight = imgRect.height;
  const halfWidth = vpWidth / 2;
  const halfHeight = vpHeight / 2;

  const maxX = (halfWidth / scale - centerFromBoundaryX) * -1;
  const minX = maxX - (curImgWidth * (1 / scale) - vpWidth * (1 / scale));

  const maxY = (halfHeight / scale - centerFromBoundaryY) * -1;
  const minY = maxY - (curImgHeight * (1 / scale) - vpHeight * (1 / scale));

  const originMinX = (1 / scale) * halfWidth;
  const originMaxX = curImgWidth * (1 / scale) - originMinX;

  const originMinY = (1 / scale) * halfHeight;
  const originMaxY = curImgHeight * (1 / scale) - originMinY;

  return {
    translate: { maxX, minX, maxY, minY },
    origin: { maxX: originMaxX, minX: originMinX, maxY: originMaxY, minY: originMinY },
  };
}

function _updateCenterPoint(rotate) {
  const self = this;
  const scale = self._currentZoom;
  const data = self.elements.preview.getBoundingClientRect();
  const vpData = self.elements.viewport.getBoundingClientRect();
  const transform = Transform.parse(self.elements.preview.style[CSS_TRANSFORM]);
  const pc = new TransformOrigin(self.elements.preview);
  const top = vpData.top - data.top + vpData.height / 2;
  const left = vpData.left - data.left + vpData.width / 2;
  const center = {};
  const adj = {};

  if (rotate) {
    const cx = pc.x;
    const cy = pc.y;
    const tx = transform.x;
    const ty = transform.y;

    center.y = cx;
    center.x = cy;
    transform.y = tx;
    transform.x = ty;
  } else {
    center.y = top / scale;
    center.x = left / scale;

    adj.y = (center.y - pc.y) * (1 - scale);
    adj.x = (center.x - pc.x) * (1 - scale);

    transform.x -= adj.x;
    transform.y -= adj.y;
  }

  const newCss: Record<string, string> = {};
  newCss[CSS_TRANS_ORG] = `${center.x}px ${center.y}px`;
  newCss[CSS_TRANSFORM] = transform.toString();
  css(self.elements.preview, newCss);
}

function _initDraggable() {
  const self = this;
  let isDragging = false;
  let originalX, originalY, originalDistance, vpRect, transform;

  const assignTransformCoordinates = (deltaX, deltaY) => {
    const imgRect = self.elements.preview.getBoundingClientRect();
    const top = transform.y + deltaY;
    const left = transform.x + deltaX;

    if (self.options.enforceBoundary) {
      if (vpRect.top > imgRect.top + deltaY && vpRect.bottom < imgRect.bottom + deltaY) {
        transform.y = top;
      }

      if (vpRect.left > imgRect.left + deltaX && vpRect.right < imgRect.right + deltaX) {
        transform.x = left;
      }
    } else {
      transform.y = top;
      transform.x = left;
    }
  };

  const toggleGrabState = (isDragging) => {
    self.elements.preview.setAttribute("aria-grabbed", isDragging);
    self.elements.boundary.setAttribute("aria-dropeffect", isDragging ? "move" : "none");
  };

  const keyDown = (ev) => {
    const LEFT_ARROW = 37;
    const UP_ARROW = 38;
    const RIGHT_ARROW = 39;
    const DOWN_ARROW = 40;

    if (ev.shiftKey && (ev.keyCode === UP_ARROW || ev.keyCode === DOWN_ARROW)) {
      const zoom =
        ev.keyCode === UP_ARROW
          ? parseFloat(self.elements.zoomer.value) + parseFloat(self.elements.zoomer.step)
          : parseFloat(self.elements.zoomer.value) - parseFloat(self.elements.zoomer.step);
      self.setZoom(zoom);
    } else if (self.options.enableKeyMovement && ev.keyCode >= 37 && ev.keyCode <= 40) {
      ev.preventDefault();
      const movement = parseKeyDown(ev.keyCode);

      transform = Transform.parse(self.elements.preview);
      document.body.style[CSS_USERSELECT] = "none";
      vpRect = self.elements.viewport.getBoundingClientRect();
      keyMove(movement);
    }

    function parseKeyDown(key) {
      switch (key) {
        case LEFT_ARROW:
          return [1, 0];
        case UP_ARROW:
          return [0, 1];
        case RIGHT_ARROW:
          return [-1, 0];
        case DOWN_ARROW:
          return [0, -1];
      }
    }
  };

  const keyMove = (movement) => {
    const [deltaX, deltaY] = movement;
    const newCss: Record<string, string> = {};

    assignTransformCoordinates(deltaX, deltaY);

    newCss[CSS_TRANSFORM] = transform.toString();
    css(self.elements.preview, newCss);
    _updateOverlay.call(self);
    document.body.style[CSS_USERSELECT] = "";
    _updateCenterPoint.call(self);
    _triggerUpdate.call(self);
    originalDistance = 0;
  };

  const mouseDown = (ev) => {
    if (ev.button !== undefined && ev.button !== 0) return;

    ev.preventDefault();
    if (isDragging) return;
    isDragging = true;
    originalX = ev.pageX;
    originalY = ev.pageY;

    if (ev.touches) {
      const touches = ev.touches[0];
      originalX = touches.pageX;
      originalY = touches.pageY;
    }
    toggleGrabState(isDragging);
    transform = Transform.parse(self.elements.preview);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("touchmove", mouseMove);
    window.addEventListener("mouseup", mouseUp);
    window.addEventListener("touchend", mouseUp);
    document.body.style[CSS_USERSELECT] = "none";
    vpRect = self.elements.viewport.getBoundingClientRect();
  };

  const mouseMove = (ev) => {
    ev.preventDefault();
    let pageX = ev.pageX;
    let pageY = ev.pageY;

    if (ev.touches) {
      const touches = ev.touches[0];
      pageX = touches.pageX;
      pageY = touches.pageY;
    }

    const deltaX = pageX - originalX;
    const deltaY = pageY - originalY;
    const newCss: Record<string, string> = {};

    if (ev.type === "touchmove") {
      if (ev.touches.length > 1) {
        const touch1 = ev.touches[0];
        const touch2 = ev.touches[1];
        const dist = Math.sqrt(
          (touch1.pageX - touch2.pageX) * (touch1.pageX - touch2.pageX) +
            (touch1.pageY - touch2.pageY) * (touch1.pageY - touch2.pageY)
        );

        if (!originalDistance) {
          originalDistance = dist / self._currentZoom;
        }

        const scale = dist / originalDistance;

        _setZoomerVal.call(self, scale);
        dispatchChange(self.elements.zoomer);
        return;
      }
    }

    assignTransformCoordinates(deltaX, deltaY);

    newCss[CSS_TRANSFORM] = transform.toString();
    css(self.elements.preview, newCss);
    _updateOverlay.call(self);
    originalY = pageY;
    originalX = pageX;
  };

  const mouseUp = () => {
    isDragging = false;
    toggleGrabState(isDragging);
    window.removeEventListener("mousemove", mouseMove);
    window.removeEventListener("touchmove", mouseMove);
    window.removeEventListener("mouseup", mouseUp);
    window.removeEventListener("touchend", mouseUp);
    document.body.style[CSS_USERSELECT] = "";
    _updateCenterPoint.call(self);
    _triggerUpdate.call(self);
    originalDistance = 0;
  };

  self.elements.overlay.addEventListener("mousedown", mouseDown);
  self.elements.viewport.addEventListener("keydown", keyDown);
  self.elements.overlay.addEventListener("touchstart", mouseDown);
}

function _updateOverlay() {
  if (!this.elements) return; // since this is debounced, it can be fired after destroy
  const self = this;
  const boundRect = self.elements.boundary.getBoundingClientRect();
  const imgData = self.elements.preview.getBoundingClientRect();

  css(self.elements.overlay, {
    width: `${imgData.width}px`,
    height: `${imgData.height}px`,
    top: `${imgData.top - boundRect.top}px`,
    left: `${imgData.left - boundRect.left}px`,
  });
}
const _debouncedOverlay = debounce(_updateOverlay, 500);

function _triggerUpdate() {
  const self = this;
  const data = self.get();

  if (!_isVisible.call(self)) {
    return;
  }

  self.options.update.call(self, data);
  const ev = window.CustomEvent
    ? new CustomEvent("update", { detail: data })
    : (() => {
        const evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("update", true, true, data);
        return evt;
      })();

  self.element.dispatchEvent(ev);
}

const _isVisible = function () {
  return this.elements.preview.offsetHeight > 0 && this.elements.preview.offsetWidth > 0;
};

function _updatePropertiesFromImage() {
  const self = this;
  const initialZoom = 1;
  const cssReset: Record<string, string | number> = {};
  const img = self.elements.preview;
  let imgData;
  const transformReset = new Transform(0, 0, initialZoom);
  const originReset = new TransformOrigin();
  const isVisible = _isVisible.call(self);

  if (!isVisible || self.data.bound) {
    // if the croppie isn't visible or it doesn't need binding
    return;
  }

  self.data.bound = true;

  cssReset[CSS_TRANSFORM] = transformReset.toString();
  cssReset[CSS_TRANS_ORG] = originReset.toString();
  cssReset["opacity"] = 1;
  css(img, cssReset);

  imgData = self.elements.preview.getBoundingClientRect();

  self._originalImageWidth = imgData.width;
  self._originalImageHeight = imgData.height;
  self.data.orientation = _hasExif.call(self)
    ? getExifOrientation(self.elements.img)
    : self.data.orientation;

  if (self.options.enableZoom) {
    _updateZoomLimits.call(self, true);
  } else {
    self._currentZoom = initialZoom;
  }

  transformReset.scale = self._currentZoom;
  cssReset[CSS_TRANSFORM] = transformReset.toString();
  css(img, cssReset);

  if (self.data.points.length) {
    _bindPoints.call(self, self.data.points);
  } else {
    _centerImage.call(self);
  }

  _updateCenterPoint.call(self);
  _updateOverlay.call(self);
}

function _updateZoomLimits(initial) {
  const self = this;
  let minZoom = Math.max(self.options.minZoom, 0) || 0;
  let maxZoom = self.options.maxZoom || 5.0;
  let initialZoom, defaultInitialZoom;
  const zoomer = self.elements.zoomer;
  const scale = parseFloat(zoomer.value);
  const boundaryData = self.elements.boundary.getBoundingClientRect();
  const imgData = naturalImageDimensions(self.elements.img, self.data.orientation);
  const vpData = self.elements.viewport.getBoundingClientRect();

  if (self.options.enforceBoundary) {
    const minW = vpData.width / imgData.width;
    const minH = vpData.height / imgData.height;
    minZoom = Math.max(minW, minH);
  }

  if (minZoom >= maxZoom) {
    maxZoom = minZoom + 1;
  }

  zoomer.min = fix(minZoom, 4);
  zoomer.max = fix(maxZoom, 4);

  if (!initial && (scale < zoomer.min || scale > zoomer.max)) {
    _setZoomerVal.call(self, scale < zoomer.min ? zoomer.min : zoomer.max);
  } else if (initial) {
    defaultInitialZoom = Math.max(
      boundaryData.width / imgData.width,
      boundaryData.height / imgData.height
    );
    initialZoom = self.data.boundZoom !== null ? self.data.boundZoom : defaultInitialZoom;
    _setZoomerVal.call(self, initialZoom);
  }

  dispatchChange(zoomer);
}

function _bindPoints(points) {
  if (points.length !== 4) {
    throw `Croppie - Invalid number of points supplied: ${points}`;
  }
  const self = this;
  const pointsWidth = points[2] - points[0];
  // pointsHeight = points[3] - points[1],
  const vpData = self.elements.viewport.getBoundingClientRect();
  const boundRect = self.elements.boundary.getBoundingClientRect();
  const vpOffset = {
    left: vpData.left - boundRect.left,
    top: vpData.top - boundRect.top,
  };
  const scale = vpData.width / pointsWidth;
  const originTop = points[1];
  const originLeft = points[0];
  const transformTop = -1 * points[1] + vpOffset.top;
  const transformLeft = -1 * points[0] + vpOffset.left;
  const newCss: Record<string, string> = {};

  newCss[CSS_TRANS_ORG] = `${originLeft}px ${originTop}px`;
  newCss[CSS_TRANSFORM] = new Transform(transformLeft, transformTop, scale).toString();
  css(self.elements.preview, newCss);

  _setZoomerVal.call(self, scale);
  self._currentZoom = scale;
}

function _centerImage() {
  const self = this;
  const imgDim = self.elements.preview.getBoundingClientRect();
  const vpDim = self.elements.viewport.getBoundingClientRect();
  const boundDim = self.elements.boundary.getBoundingClientRect();
  const vpLeft = vpDim.left - boundDim.left;
  const vpTop = vpDim.top - boundDim.top;
  const w = vpLeft - (imgDim.width - vpDim.width) / 2;
  const h = vpTop - (imgDim.height - vpDim.height) / 2;
  const transform = new Transform(w, h, self._currentZoom);

  css(self.elements.preview, CSS_TRANSFORM, transform.toString());
}

function _transferImageToCanvas(customOrientation) {
  const self = this;
  const canvas = self.elements.canvas;
  const img = self.elements.img;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.width = img.width;
  canvas.height = img.height;

  const orientation =
    (self.options.enableOrientation && customOrientation) || getExifOrientation(img);
  drawCanvas(canvas, img, orientation);
}

function _getCanvas(data) {
  const self = this;
  const points = data.points;
  const left = num(points[0]);
  const top = num(points[1]);
  const right = num(points[2]);
  const bottom = num(points[3]);
  const width = right - left;
  const height = bottom - top;
  const circle = data.circle;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const canvasWidth = data.outputWidth || width;
  const canvasHeight = data.outputHeight || height;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  if (data.backgroundColor) {
    ctx.fillStyle = data.backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // By default assume we're going to draw the entire
  // source image onto the destination canvas.
  let sx = left;
  let sy = top;
  let sWidth = width;
  let sHeight = height;
  let dx = 0;
  let dy = 0;
  let dWidth = canvasWidth;
  let dHeight = canvasHeight;

  //
  // Do not go outside of the original image's bounds along the x-axis.
  // Handle translations when projecting onto the destination canvas.
  //

  // The smallest possible source x-position is 0.
  if (left < 0) {
    sx = 0;
    dx = (Math.abs(left) / width) * canvasWidth;
  }

  // The largest possible source width is the original image's width.
  if (sWidth + sx > self._originalImageWidth) {
    sWidth = self._originalImageWidth - sx;
    dWidth = (sWidth / width) * canvasWidth;
  }

  //
  // Do not go outside of the original image's bounds along the y-axis.
  //

  // The smallest possible source y-position is 0.
  if (top < 0) {
    sy = 0;
    dy = (Math.abs(top) / height) * canvasHeight;
  }

  // The largest possible source height is the original image's height.
  if (sHeight + sy > self._originalImageHeight) {
    sHeight = self._originalImageHeight - sy;
    dHeight = (sHeight / height) * canvasHeight;
  }

  ctx.drawImage(this.elements.preview, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
  if (circle) {
    ctx.fillStyle = "#fff";
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
  }
  return canvas;
}

function _getHtmlResult(data) {
  const points = data.points;
  const div = document.createElement("div");
  const img = document.createElement("img");
  img.setAttribute("crossOrigin", "anonymous");
  const width = points[2] - points[0];
  const height = points[3] - points[1];

  addClass(div, "croppie-result");
  div.appendChild(img);
  css(img, {
    left: `${-1 * points[0]}px`,
    top: `${-1 * points[1]}px`,
  });
  img.src = data.url;
  css(div, {
    width: `${width}px`,
    height: `${height}px`,
  });

  return div;
}

const _getBase64Result = function (data) {
  return _getCanvas.call(this, data).toDataURL(data.format, data.quality);
};

const _getBlobResult = function (data) {
  const self = this;
  return new Promise((resolve) => {
    _getCanvas.call(self, data).toBlob(
      (blob) => {
        resolve(blob);
      },
      data.format,
      data.quality
    );
  });
};

function _replaceImage(img) {
  if (this.elements.img.parentNode) {
    [...this.elements.img.classList].forEach((c) => img.classList.add(c));
    this.elements.img.parentNode.replaceChild(img, this.elements.img);
    this.elements.preview = img; // if the img is attached to the DOM, they're not using the canvas
  }
  this.elements.img = img;
}

function _bind(options, cb) {
  const self = this;
  let url,
    points = [],
    zoom = null;
  const hasExif = _hasExif.call(self);

  if (typeof options === "string") {
    url = options;
    options = {};
  } else if (Array.isArray(options)) {
    points = options.slice();
  } else if (typeof options === "undefined" && self.data.url) {
    //refreshing
    _updatePropertiesFromImage.call(self);
    _triggerUpdate.call(self);
    return null;
  } else {
    url = options.url;
    points = options.points || [];
    zoom = typeof options.zoom === "undefined" ? null : options.zoom;
  }

  self.data.bound = false;
  self.data.url = url || self.data.url;
  self.data.boundZoom = zoom;

  return loadImage(url, hasExif).then((img) => {
    _replaceImage.call(self, img);
    if (!points.length) {
      const natDim = naturalImageDimensions(img);
      const rect = self.elements.viewport.getBoundingClientRect();
      const aspectRatio = rect.width / rect.height;
      const imgAspectRatio = natDim.width / natDim.height;
      let width, height;

      if (imgAspectRatio > aspectRatio) {
        height = natDim.height;
        width = height * aspectRatio;
      } else {
        width = natDim.width;
        height = natDim.height / aspectRatio;
      }

      const x0 = (natDim.width - width) / 2;
      const y0 = (natDim.height - height) / 2;
      const x1 = x0 + width;
      const y1 = y0 + height;
      self.data.points = [x0, y0, x1, y1];
    } else if (self.options.relative) {
      points = [
        (points[0] * img.naturalWidth) / 100,
        (points[1] * img.naturalHeight) / 100,
        (points[2] * img.naturalWidth) / 100,
        (points[3] * img.naturalHeight) / 100,
      ];
    }

    self.data.orientation = options.orientation || 1;
    self.data.points = points.map((p) => parseFloat(p));
    if (self.options.useCanvas) {
      _transferImageToCanvas.call(self, self.data.orientation);
    }
    _updatePropertiesFromImage.call(self);
    _triggerUpdate.call(self);
    cb && cb();
  });
}

const fix = (v, decimalPoints) => parseFloat(v).toFixed(decimalPoints || 0);

function _get() {
  var self = this,
    imgData = self.elements.preview.getBoundingClientRect(),
    vpData = self.elements.viewport.getBoundingClientRect(),
    x1 = vpData.left - imgData.left,
    y1 = vpData.top - imgData.top,
    x2 = x1 + vpData.width,
    y2 = y1 + vpData.height,
    scale = self._currentZoom;

  if (scale === Infinity || isNaN(scale)) {
    scale = 1;
  }

  var max = self.options.enforceBoundary ? 0 : Number.NEGATIVE_INFINITY;
  x1 = Math.max(max, x1 / scale);
  y1 = Math.max(max, y1 / scale);
  x2 = Math.max(max, x2 / scale);
  y2 = Math.max(max, y2 / scale);

  return {
    points: [fix(x1), fix(y1), fix(x2), fix(y2)],
    zoom: scale,
    orientation: self.data.orientation,
  };
}

const RESULT_DEFAULTS = {
  type: "canvas",
  format: "png",
  quality: 1,
};
const RESULT_FORMATS = ["jpeg", "webp", "png"];

function _result(options) {
  const self = this;
  const data = _get.call(self);
  const opts = deepExtend(clone(RESULT_DEFAULTS), clone(options));
  const resultType = typeof options === "string" ? options : opts.type || "base64";
  const size = opts.size || "viewport";
  const format = opts.format;
  const quality = opts.quality;
  const backgroundColor = opts.backgroundColor;
  const circle =
    typeof opts.circle === "boolean" ? opts.circle : self.options.viewport.type === "circle";
  const vpRect = self.elements.viewport.getBoundingClientRect();
  const ratio = vpRect.width / vpRect.height;

  if (size === "viewport") {
    data.outputWidth = vpRect.width;
    data.outputHeight = vpRect.height;
  } else if (typeof size === "object") {
    if (size.width && size.height) {
      data.outputWidth = size.width;
      data.outputHeight = size.height;
    } else if (size.width) {
      data.outputWidth = size.width;
      data.outputHeight = size.width / ratio;
    } else if (size.height) {
      data.outputWidth = size.height * ratio;
      data.outputHeight = size.height;
    }
  }

  if (RESULT_FORMATS.indexOf(format) > -1) {
    data.format = `image/${format}`;
    data.quality = quality;
  }

  data.circle = circle;
  data.url = self.data.url;
  data.backgroundColor = backgroundColor;

  const prom = new Promise((resolve) => {
    switch (resultType.toLowerCase()) {
      case "points":
        resolve(data.points);
        break;
      case "rawcanvas":
        resolve(_getCanvas.call(self, data));
        break;
      case "canvas":
      case "base64":
        resolve(_getBase64Result.call(self, data));
        break;
      case "blob":
        _getBlobResult.call(self, data).then(resolve);
        break;
      default:
        resolve(_getHtmlResult.call(self, data));
        break;
    }
  });
  return prom;
}

function _refresh() {
  _updatePropertiesFromImage.call(this);
}

function _rotate(deg) {
  if (!this.options.useCanvas || !this.options.enableOrientation) {
    throw "Croppie: Cannot rotate without enableOrientation && EXIF.js included";
  }

  const self = this;
  const canvas = self.elements.canvas;

  self.data.orientation = getExifOffset(self.data.orientation, deg);
  drawCanvas(canvas, self.elements.img, self.data.orientation);
  _updateCenterPoint.call(self, true);
  _updateZoomLimits.call(self);

  // Reverses image dimensions if the degrees of rotation is not divisible by 180.
  if ((Math.abs(deg) / 90) % 2 === 1) {
    const oldHeight = self._originalImageHeight;
    const oldWidth = self._originalImageWidth;
    self._originalImageWidth = oldHeight;
    self._originalImageHeight = oldWidth;
  }
}

function _destroy() {
  const self = this;
  self.element.removeChild(self.elements.boundary);
  removeClass(self.element, "croppie-container");
  if (self.options.enableZoom) {
    self.element.removeChild(self.elements.zoomerWrap);
  }
  delete self.elements;
}

class Croppie {
  element: HTMLElement;
  options: CroppieOptions;
  elements!: CroppieElements;
  data!: CroppieData;
  _currentZoom!: number;
  _originalImageWidth!: number;
  _originalImageHeight!: number;

  static defaults: CroppieOptions = {
    viewport: {
      width: 100,
      height: 100,
      type: "square",
    },
    boundary: {},
    orientationControls: {
      enabled: true,
      leftClass: "",
      rightClass: "",
    },
    resizeControls: {
      width: true,
      height: true,
    },
    customClass: "",
    showZoomer: true,
    enableZoom: true,
    enableResize: false,
    mouseWheelZoom: true,
    enableExif: false,
    enforceBoundary: true,
    enableOrientation: false,
    enableKeyMovement: true,
    update: () => {},
  };

  static globals = {
    translate: "translate3d",
  };

  constructor(element: HTMLElement, opts?: CroppieOptions) {
    if (element.className.indexOf("croppie-container") > -1) {
      throw new Error("Croppie: Can't initialize croppie more than once");
    }
    this.element = element;
    this.options = deepExtend(clone(Croppie.defaults), opts);

    if (this.element.tagName.toLowerCase() === "img") {
      const origImage = this.element as HTMLImageElement;
      addClass(origImage, "cr-original-image");
      setAttributes(origImage, { "aria-hidden": "true", alt: "" });
      const replacementDiv = document.createElement("div");
      this.element.parentNode!.appendChild(replacementDiv);
      replacementDiv.appendChild(origImage);
      this.element = replacementDiv;
      this.options.url = this.options.url || origImage.src;
    }

    _create.call(this);
    if (this.options.url) {
      const bindOpts: CroppieBindOptions = {
        url: this.options.url,
        points: this.options.points,
      };
      delete this.options["url"];
      delete this.options["points"];
      _bind.call(this, bindOpts);
    }

    this.options.relative = false;
    this.options.minZoom = 0;
  }

  bind(options?: string | number[] | CroppieBindOptions, cb?: () => void): Promise<void> | null {
    return _bind.call(this, options, cb);
  }

  get(): CroppieResult {
    const data = _get.call(this);
    const points = data.points;
    if (this.options.relative) {
      points[0] = ((parseFloat(points[0]) / this.elements.img.naturalWidth) * 100).toString();
      points[1] = ((parseFloat(points[1]) / this.elements.img.naturalHeight) * 100).toString();
      points[2] = ((parseFloat(points[2]) / this.elements.img.naturalWidth) * 100).toString();
      points[3] = ((parseFloat(points[3]) / this.elements.img.naturalHeight) * 100).toString();
    }
    return data;
  }

  result(
    type?: string | CroppieResultOptions
  ): Promise<string | HTMLElement | Blob | HTMLCanvasElement | string[]> {
    return _result.call(this, type);
  }

  refresh(): void {
    return _refresh.call(this);
  }

  setZoom(v: number): void {
    _setZoomerVal.call(this, v);
    dispatchChange(this.elements.zoomer!);
  }

  getMinZoom(): number {
    return parseFloat(this.elements.zoomer?.min || "0");
  }

  getMaxZoom(): number {
    return parseFloat(this.elements.zoomer?.max || "1");
  }

  mapZoom(normalizedValue: number): number {
    const min = this.getMinZoom();
    const max = this.getMaxZoom();
    return min + (max - min) * Math.max(0, Math.min(1, normalizedValue));
  }

  rotate(deg: number): void {
    _rotate.call(this, deg);
  }

  destroy(): void {
    return _destroy.call(this);
  }
}

// Export for different module systems
if (typeof module !== "undefined" && module.exports) {
  // CommonJS
  module.exports = Croppie;
} else if (typeof define === "function" && (define as any).amd) {
  // AMD
  define([], function () {
    return Croppie;
  });
} else {
  // Browser global
  if (typeof window !== "undefined") {
    window.Croppie = Croppie;
  }
}

export default Croppie;
