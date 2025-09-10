<template>
  <div class="wrap">
    <h2>Members</h2>

    <div v-if="ownerError" class="warn">
      {{ ownerError }}
    </div>

    <form class="row" @submit.prevent="invite">
      <input
        v-model.trim="inviteEmail"
        type="email"
        placeholder="email@example.com"
        required
        :disabled="inviting || isOwnerBlocked"
      />
      <button :disabled="inviting || isOwnerBlocked">
        {{ inviting ? 'Adding…' : 'Add member' }}
      </button>
    </form>

    <div v-if="error" class="error">{{ error }}</div>

    <ul class="list" v-if="members.length">
      <li v-for="u in members" :key="u._id" class="row between">
        <span>{{ u.email }}</span>
        <button class="danger" @click="remove(u._id)" :disabled="removingId === u._id || isOwnerBlocked">
          {{ removingId === u._id ? 'Removing…' : 'Remove' }}
        </button>
      </li>
    </ul>

    <p v-else class="muted">No members yet.</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { apiGet, apiPost } from '../api.js';

const members = ref([]);
const inviteEmail = ref('');
const inviting = ref(false);
const removingId = ref('');
const error = ref('');
const ownerError = ref('');
const isOwnerBlocked = ref(false);

async function load() {
  error.value = '';
  try {
    const { items } = await apiGet('/tenant/members');
    members.value = items || [];
  } catch (e) {
    error.value = e?.body?.error || e.message;
  }
}

async function invite() {
  try {
    inviting.value = true;
    ownerError.value = '';
    await apiPost('/tenant/members', { email: inviteEmail.value });
    inviteEmail.value = '';
    await load();
  } catch (e) {
    const msg = e?.body?.error || e.message;
    if (e?.status === 403) {
      ownerError.value = 'Only the production owner can add or remove members.';
      isOwnerBlocked.value = true;
    } else {
      error.value = msg;
    }
  } finally {
    inviting.value = false;
  }
}

async function remove(id) {
  try {
    removingId.value = id;
    ownerError.value = '';
    await apiPost(`/tenant/members/${id}`, null, { method: 'DELETE' });
    await load();
  } catch (e) {
    const msg = e?.body?.error || e.message;
    if (e?.status === 403) {
      ownerError.value = 'Only the production owner can add or remove members.';
      isOwnerBlocked.value = true;
    } else {
      error.value = msg;
    }
  } finally {
    removingId.value = '';
  }
}

onMounted(load);
</script>

<style scoped>
.wrap { max-width: 720px; margin: 24px auto; padding: 0 12px; }
.row { display: flex; align-items: center; gap: 8px; }
.row.between { justify-content: space-between; }
.list { list-style: none; padding: 0; margin-top: 16px; }
.muted { color: #666; }
.warn { background: #fff9e6; border: 1px solid #ffe08a; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
.error { color: #c00; margin-top: 8px; }
button { padding: 8px 12px; border-radius: 8px; border: 1px solid #ddd; background: #111; color: #fff; cursor: pointer; }
button[disabled] { opacity: .6; cursor: default; }
button.danger { background: #b00020; border-color: #b00020; }
input { flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; }
</style>