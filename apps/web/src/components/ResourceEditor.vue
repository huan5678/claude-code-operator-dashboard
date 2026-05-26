<script setup>
import { ref, watch } from 'vue';
import MarkdownView from './MarkdownView.vue';

const props = defineProps({
  resource: { type: Object, required: true },
});
const emit = defineEmits(['save']);

const frontmatterText = ref('');
const body = ref('');
const editMode = ref(false);
const saving = ref(false);
const error = ref(null);

watch(() => props.resource, (r) => {
  frontmatterText.value = JSON.stringify(r.frontmatter ?? {}, null, 2);
  body.value = r.body ?? '';
  editMode.value = false;
  error.value = null;
}, { immediate: true });

async function save() {
  error.value = null;
  let fm;
  try { fm = JSON.parse(frontmatterText.value || '{}'); }
  catch (e) {
    error.value = 'Frontmatter JSON 格式錯誤：' + e.message;
    return;
  }
  saving.value = true;
  try {
    emit('save', {
      frontmatter: fm,
      body: body.value,
      expectedMtime: props.resource.mtime,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="editor-shell">
    <div class="toolbar">
      <button @click="editMode = !editMode">{{ editMode ? '取消編輯' : '✏️ 編輯' }}</button>
      <button v-if="editMode" class="primary" :disabled="saving" @click="save">💾 儲存</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="editMode">
      <div class="card">
        <h3 style="margin-top: 0">Frontmatter (JSON)</h3>
        <textarea v-model="frontmatterText" style="min-height: 200px"></textarea>
      </div>
      <div class="card">
        <h3 style="margin-top: 0">Body (Markdown)</h3>
        <textarea v-model="body" style="min-height: 400px"></textarea>
      </div>
    </template>

    <template v-else>
      <div class="card" v-if="resource.frontmatter && Object.keys(resource.frontmatter).length">
        <h3 style="margin-top: 0">Frontmatter</h3>
        <pre style="margin: 0">{{ JSON.stringify(resource.frontmatter, null, 2) }}</pre>
      </div>
      <MarkdownView :source="body" />
    </template>
  </div>
</template>
