<script setup>
import { computed } from 'vue';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

const props = defineProps({
  source: { type: String, default: '' },
});

const html = computed(() =>
  DOMPurify.sanitize(md.render(props.source ?? ''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
  })
);
</script>

<template>
  <div class="markdown-body" v-html="html" />
</template>
