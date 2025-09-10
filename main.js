import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import router from './router.js';

import ProductPage from './views/ProductPage.vue';
import ThankYou from './views/ThankYou.vue';
import SlugApp from './views/SlugApp.vue';

const routes = [
  { path: '/', name: 'product', component: ProductPage },
  { path: '/thank-you', name: 'thank-you', component: ThankYou },
  { path: '/:slug', name: 'tenant', component: SlugApp }
];

import * as api from './api.js';

if (import.meta.env.DEV) {
  // Now in DevTools you can call: api.apiGet('/tenant/me')
  // Or if you prefer bare names, uncomment the Object.assign line.
  window.api = api;
  // Object.assign(window, api); // exposes apiGet, apiPost, setProductionId directly
}

createApp(App).use(router).mount('#app');