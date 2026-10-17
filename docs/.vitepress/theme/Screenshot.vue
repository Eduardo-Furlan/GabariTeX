<script setup lang="ts">
import manifest from '../../screenshots/manifest.json';

const props = defineProps<{
  id: string;
}>();

const entry = manifest.find((item: any) => item.id === props.id);
if (!entry) {
  if (typeof process !== 'undefined') {
    process.exitCode = 1;
  }
  throw new Error(`Screenshot manifest entry not found for id: "${props.id}"`);
}

const images = import.meta.glob<string>('/screenshots/*.png', {
  eager: true,
  import: 'default',
});

const imagePath = `/screenshots/${entry.id}.png`;
const imgSrc = images[imagePath];

// @ts-ignore
const isDev = import.meta.env.DEV;
// @ts-ignore
const showPlaceholders = isDev || (typeof __DOCS_SHOW_PLACEHOLDERS__ !== 'undefined' && Boolean(__DOCS_SHOW_PLACEHOLDERS__));
</script>

<template>
  <figure v-if="imgSrc" class="screenshot-figure">
    <img :src="imgSrc" :alt="entry.alt" loading="lazy" class="screenshot-img" />
    <figcaption v-if="entry.caption || (entry.callouts && entry.callouts.length)" class="screenshot-caption">
      <div v-if="entry.caption" class="screenshot-caption-text">{{ entry.caption }}</div>
      <ol v-if="entry.callouts && entry.callouts.length" class="screenshot-legend">
        <li v-for="callout in entry.callouts" :key="callout.n" class="screenshot-legend-item">
          <span class="legend-badge">{{ callout.n }}</span>
          <span>{{ callout.label }}</span>
        </li>
      </ol>
    </figcaption>
  </figure>
  <div v-else-if="showPlaceholders" class="screenshot-placeholder">
    <div class="placeholder-title">Screenshot pending: {{ entry.id }}</div>
    <div class="placeholder-body">
      <div class="placeholder-row"><strong>Caminho:</strong> <code>docs/screenshots/{{ entry.id }}.png</code></div>
      <div class="placeholder-row"><strong>Alvo e janela:</strong> {{ entry.target }} ({{ entry.window }})</div>
      <div class="placeholder-row"><strong>Tela:</strong> {{ entry.screen }}</div>
      <div class="placeholder-row"><strong>Estado:</strong> {{ entry.state }}</div>
      <div class="placeholder-row"><strong>Passos:</strong> {{ entry.setup }}</div>
      <div v-if="entry.mustShow && entry.mustShow.length" class="placeholder-list">
        <strong>Deve mostrar:</strong>
        <ul>
          <li v-for="(item, idx) in entry.mustShow" :key="idx">{{ item }}</li>
        </ul>
      </div>
      <div v-if="entry.mustNotShow && entry.mustNotShow.length" class="placeholder-list">
        <strong>Não deve mostrar:</strong>
        <ul>
          <li v-for="(item, idx) in entry.mustNotShow" :key="idx">{{ item }}</li>
        </ul>
      </div>
      <div class="placeholder-row"><strong>Corte:</strong> {{ entry.crop }}</div>
      <div v-if="entry.callouts && entry.callouts.length" class="placeholder-callouts">
        <strong>Marcações:</strong>
        <ol>
          <li v-for="callout in entry.callouts" :key="callout.n">
            {{ callout.target }}
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<style scoped>
.screenshot-figure {
  margin: 1.5rem 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
}

.screenshot-img {
  width: 100%;
  height: auto;
  display: block;
}

.screenshot-caption {
  padding: 0.75rem 1rem;
  background-color: var(--vp-c-bg-soft);
  font-size: 0.9rem;
  border-top: 1px solid var(--vp-c-divider);
}

.screenshot-caption-text {
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.screenshot-legend {
  list-style: none;
  padding-left: 0;
  margin: 0.5rem 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.screenshot-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  min-width: 22px;
  border-radius: 50%;
  background-color: #d92d20;
  color: #ffffff;
  font-size: 12px;
  font-weight: bold;
}

.screenshot-placeholder {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 2px dashed #f59e0b;
  border-radius: 8px;
  background-color: rgba(245, 158, 11, 0.08);
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--vp-c-text-1);
}

.placeholder-title {
  font-size: 1rem;
  font-weight: 700;
  color: #b45309;
  margin-bottom: 0.75rem;
}

.placeholder-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.placeholder-row code {
  font-size: 0.85em;
  padding: 0.15em 0.35em;
  border-radius: 4px;
}

.placeholder-list ul,
.placeholder-callouts ol {
  margin: 0.25rem 0 0.25rem 1.25rem;
  padding: 0;
}
</style>
