<template>
  <div class="container">
    <header class="bar">
      <h1>{{ prod?.title || '...' }}</h1>
      <nav>
       <nav class="nav">
  <RouterLink :to="{ name:'tenant-home', params:{ slug } }">Dashboard</RouterLink>
  <!-- more links… -->
  <RouterLink :to="{ name:'tenant-logout', params:{ slug } }">Logout</RouterLink>
</nav>
      </nav>
    </header>
    <main>
      <RouterView />  <!-- children appear here -->
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { apiGet, setProductionId } from '../api.js';

const route = useRoute();
const slug = String(route.params.slug || '');
const prod = ref(null);
const err  = ref('');

onMounted(async () => {
  try {
    // Public lookup (no auth needed)
    prod.value = await apiGet(`/productions/by-slug/${encodeURIComponent(slug)}`);
    // Seed headers for tenant endpoints
    setProductionId(prod.value._id);

    // (Optional) prove it works:
    // const me = await apiGet('/tenant/me'); console.log('tenant/me', me);
  } catch (e) {
    err.value = e.message || 'Not found';
  }
});
</script>