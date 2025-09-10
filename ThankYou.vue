<template>
  <div class="container">
    <h1>Thank you!</h1>
    <p>We’re confirming your payment. This takes a moment.</p>

    <div v-if="loading">Checking session…</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="slug">
      <p>Your production is ready:</p>
      <p><router-link :to="'/' + slug">Open {{ slug }}</router-link></p>
    </div>
    <div v-else class="muted">No slug yet. Try refreshing in a few seconds.</div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { apiGet } from '../api.js';

const route = useRoute();
const loading = ref(true);
const error = ref('');
const slug = ref('');

onMounted(async () => {
  try {
    const sessionId = String(route.query.session_id || '');
    if (!sessionId) throw new Error('Missing session_id');
    const data = await apiGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (data.slug) slug.value = data.slug;
  } catch (e) {
    error.value = e.message || 'Failed to resolve session';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.container { max-width: 760px; margin: 40px auto; padding: 0 16px; }
.error { color: #c00; }
.muted { color: #666; }
</style>