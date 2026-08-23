# Croppie

A headless Vue 3 image cropper. Croppie owns image geometry and output; the consuming app owns the dialog, buttons, slider, and every other piece of presentation.

## Install

```sh
npm install croppie-constrained
```

Import the component and its structural stylesheet.

```vue
<script setup lang="ts">
import { shallowRef, useTemplateRef } from "vue";
import Croppie from "croppie-constrained";
import "croppie-constrained/croppie.css";

const source = shallowRef<string | null>(null);
const cropper = useTemplateRef<InstanceType<typeof Croppie>>("cropper");

async function save() {
  const blob = await cropper.value?.result({
    type: "blob",
    size: "viewport",
    format: "png",
  });
}
</script>

<template>
  <Croppie
    ref="cropper"
    v-slot="{ ready, normalizedZoom, setNormalizedZoom }"
    :src="source"
    :options="{
      viewport: { width: 280, height: 280, type: 'square' },
      enforceBoundary: true,
      maxZoom: 2,
    }"
  >
    <input
      type="range"
      min="0"
      max="1"
      step="0.0001"
      :disabled="!ready"
      :value="normalizedZoom"
      @input="
        setNormalizedZoom(Number(($event.target as HTMLInputElement).value))
      "
    />
  </Croppie>
</template>
```

The default slot receives `ready`, the current crop `data`, actual and normalized zoom values, zoom limits, and setters. The component exposes `get`, `result`, `refresh`, `rotate`, `setZoom`, and `setNormalizedZoom` for imperative actions that do not fit props/events.

Events:

- `ready` after the current `src` has loaded and its first crop is stable.
- `update` whenever the crop changes.
- `error` when an image cannot be loaded.

`CroppieCore` remains available as a named export for migrations from the old imperative API. New integrations should use the Vue component.

## Transform-safe mounting

Crop geometry uses layout coordinates rather than transformed viewport snapshots. A cropper can mount and bind once while an ancestor dialog is scaling or translating; it does not need a delayed second `bind()` after the opening animation.

## Development

```sh
npm install
npm test
```
