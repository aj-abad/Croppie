<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";
import CroppieCore from "./croppie";
import type { CroppieResult, CroppieResultOptions } from "./croppie";
import type {
  CroppieComponentProps,
  CroppieSlotProps,
} from "./component-types";
import "./croppie.css";

const props = defineProps<CroppieComponentProps>();

const emit = defineEmits<{
  ready: [data: CroppieResult];
  update: [data: CroppieResult];
  error: [error: unknown];
}>();

defineSlots<{
  default: (props: CroppieSlotProps) => unknown;
}>();

const container = useTemplateRef<HTMLDivElement>("container");
const cropper = shallowRef<CroppieCore | null>(null);
const ready = shallowRef(false);
const data = shallowRef<CroppieResult | null>(null);
const zoom = shallowRef(0);
const minZoom = shallowRef(0);
const maxZoom = shallowRef(1);
let bindGeneration = 0;
let resizeObserver: ResizeObserver | null = null;
let resizeFrame: number | null = null;

const normalizedZoom = computed(() => {
  const range = maxZoom.value - minZoom.value;
  return range > 0 ? (zoom.value - minZoom.value) / range : 0;
});

const optionsSignature = computed(() => JSON.stringify(props.options ?? {}));
const bindSignature = computed(() => JSON.stringify(props.bind ?? {}));

function syncZoomState(): void {
  const instance = cropper.value;
  if (!instance) return;

  minZoom.value = instance.getMinZoom();
  maxZoom.value = instance.getMaxZoom();
  zoom.value = data.value?.zoom ?? minZoom.value;
}

function handleUpdate(nextData: CroppieResult): void {
  data.value = nextData;
  zoom.value = nextData.zoom;
  syncZoomState();
  props.options?.update?.(nextData);
  emit("update", nextData);
}

async function bindSource(): Promise<void> {
  const instance = cropper.value;
  const source = props.src;
  const generation = ++bindGeneration;

  ready.value = false;
  data.value = null;
  if (!instance || !source) return;

  try {
    await instance.bind({ ...props.bind, url: source });
    if (generation !== bindGeneration || instance !== cropper.value) return;

    const nextData = instance.get();
    data.value = nextData;
    syncZoomState();
    ready.value = true;
    emit("ready", nextData);
  } catch (error) {
    if (generation !== bindGeneration) return;
    emit("error", error);
  }
}

function destroyCropper(): void {
  bindGeneration++;
  ready.value = false;
  data.value = null;
  cropper.value?.destroy();
  cropper.value = null;
}

async function createCropper(): Promise<void> {
  await nextTick();
  const element = container.value;
  if (!element) return;

  destroyCropper();
  cropper.value = new CroppieCore(element, {
    ...props.options,
    viewport: { ...props.options?.viewport },
    boundary: { ...props.options?.boundary },
    showZoomer: false,
    update: handleUpdate,
  });
  await bindSource();
}

function refresh(): void {
  if (!ready.value) return;
  cropper.value?.refresh();
  syncZoomState();
}

function setZoom(value: number): void {
  cropper.value?.setZoom(value);
}

function setNormalizedZoom(value: number): void {
  cropper.value?.setZoom(cropper.value.mapZoom(value));
}

function get(): CroppieResult {
  if (!cropper.value || !ready.value) {
    throw new Error("Croppie is not ready");
  }
  return cropper.value.get();
}

function result(
  options?: string | CroppieResultOptions,
): Promise<string | HTMLElement | Blob | HTMLCanvasElement | string[]> {
  if (!cropper.value || !ready.value) {
    return Promise.reject(new Error("Croppie is not ready"));
  }
  return cropper.value.result(options);
}

function rotate(degrees: number): void {
  cropper.value?.rotate(degrees);
}

onMounted(async () => {
  await createCropper();

  if (!container.value) return;
  resizeObserver = new ResizeObserver(() => {
    if (!ready.value || resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      refresh();
    });
  });
  resizeObserver.observe(container.value);
});

watch(
  () => props.src,
  () => {
    if (cropper.value) void bindSource();
  },
);

watch(optionsSignature, () => {
  if (cropper.value) void createCropper();
});

watch(bindSignature, () => {
  if (cropper.value) void bindSource();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
  destroyCropper();
});

defineExpose({
  get,
  refresh,
  result,
  rotate,
  setNormalizedZoom,
  setZoom,
});
</script>

<template>
  <div class="croppie-vue">
    <div ref="container" class="croppie-vue__surface" />
    <slot
      :ready="ready"
      :data="data"
      :zoom="zoom"
      :min-zoom="minZoom"
      :max-zoom="maxZoom"
      :normalized-zoom="normalizedZoom"
      :set-zoom="setZoom"
      :set-normalized-zoom="setNormalizedZoom"
    />
  </div>
</template>
