<script setup>
// Profile photo when there is one, otherwise the name's initials.
import { ref, watch } from 'vue';
import { initials } from '../util.js';

const props = defineProps({ name: String, photo: String, size: { type: Number, default: 40 }, gray: Boolean });
const broken = ref(false);
watch(() => props.photo, () => { broken.value = false; });
</script>

<template>
  <span class="av" :class="{ gray: gray && !(photo && !broken) }" :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size / 3) + 'px' }">
    <img v-if="photo && !broken" :src="photo" alt="" @error="broken = true" />
    <template v-else>{{ initials(name) }}</template>
  </span>
</template>

<style scoped>
.av { overflow: hidden; }
.av img { width: 100%; height: 100%; object-fit: cover; }
.av.gray { background: var(--soft); color: var(--muted); }
</style>
