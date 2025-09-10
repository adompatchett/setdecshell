<template>
  <div class="container">
    <h1>Set-Dec Runner</h1>
    <p>Digital run-sheets for film set decoration. One-time purchase per production.</p>

    <div class="card">
      <h2>Buy a Production</h2>
      <form @submit.prevent="startCheckout" class="col gap">
        <label>
          Production title
          <input v-model.trim="title" placeholder="Dune: Part Two" required />
        </label>
        <label>
          Desired slug (URL)
          <input v-model.trim="slug" placeholder="dune-2" required />
        </label>
        <button :disabled="loading">{{ loading ? 'Redirecting…' : 'Buy now' }}</button>
      </form>
      <p v-if="err" class="error">{{ err }}</p>
    </div>

    <div v-if="$route.query.canceled" class="muted">Checkout canceled.</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { apiPost } from '../api.js';

const title = ref('');
const slug  = ref('');
const loading = ref(false);
const err = ref('');

async function startCheckout() {
  try {
    loading.value = true;
    err.value = '';
    const { url } = await apiPost('/checkout/session', { title: title.value, desiredSlug: slug.value });
    window.location.assign(url); // to Stripe
  } catch (e) {
    err.value = e.message || 'Unable to start checkout';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.container { max-width: 760px; margin: 40px auto; padding: 0 16px; }
.card { border: 1px solid #e5e5e5; padding: 16px; border-radius: 10px; }
.col.gap { display: grid; gap: 10px; }
.error { color: #c00; margin-top: 8px; }
.muted { color: #666; margin-top: 12px; }
button { padding: 10px 14px; }
input { width: 100%; padding: 8px 10px; }
</style>
