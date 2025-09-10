// client/src/router.js
import { createRouter, createWebHistory } from 'vue-router';
import { apiGet } from './api.js';
import { logout } from './auth.js';

import ProductPage from './views/ProductPage.vue';
import ThankYou from './views/ThankYou.vue';
import SlugLayout from './views/SlugApp.vue';
import TenantLogin from './views/Login.vue';
import TenantHome from './views/TenantHome.vue';
import Members from './views/Members.vue';

function getToken() {
  const t = localStorage.getItem('token');
  return t && t !== 'undefined' && t !== 'null' ? t : '';
}

function isAuthed() {
  const t = getToken();
  if (!t) return false;
  const parts = t.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1]));
      if (payload?.exp && Date.now() >= payload.exp * 1000) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return false;
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return false;
    }
  }
  return true;
}

function userHasProduction(prodId) {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || !prodId) return false;
    const list = user.productionIds || (user.productionId ? [user.productionId] : []);
    return Array.isArray(list) && list.map(String).includes(String(prodId));
  } catch {
    return false;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'marketing', component: ProductPage },
    { path: '/thank-you', name: 'thank-you', component: ThankYou },

    {
      path: '/:slug',
      component: SlugLayout,
      // Validate production before any child renders
      async beforeEnter(to) {
        const slug = String(to.params.slug || '').toLowerCase();
        try {
          const prod = await apiGet(`/productions/by-slug/${encodeURIComponent(slug)}`);
          localStorage.setItem('lastSlug', slug);
          localStorage.setItem('currentProductionId', prod._id);
          return true;
        } catch {
          return { path: '/' };
        }
      },
      children: [
        { path: 'login', name: 'tenant-login', component: TenantLogin, meta: { guestOnlyTenant: true } },
        
{ path: 'members', name: 'tenant-members',
  component: Members,
  meta: { requiresAuth: true, requiresMembership: true } },
        // Default dashboard (/:slug) — if not authed, force /:slug/login
        {
          path: '',
          name: 'tenant-home',
          component: TenantHome,
          meta: { requiresAuth: true, requiresMembership: true },
          beforeEnter: (to) => {
            const slug = String(to.params.slug || '');
            if (!isAuthed()) {
              return { name: 'tenant-login', params: { slug }, query: { r: `/${slug}` }, replace: true };
            }
            // membership check handled in global guard too
            return true;
          },
        },

        // Logout
        {
          path: 'logout',
          name: 'tenant-logout',
          beforeEnter: (to) => {
            logout();
            const slug = String(to.params.slug || '');
            return { name: 'tenant-login', params: { slug } };
          },
        },
      ],
    },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

// Global guard: enforce auth & membership per production
router.beforeEach((to) => {
  const isTenant = !!to.params?.slug;
  if (!isTenant) return true;

  const slug = String(to.params.slug);
  const prodId = localStorage.getItem('currentProductionId') || '';

  // If at /:slug/login and already valid member → go to dashboard
  if (to.meta?.guestOnlyTenant) {
    if (isAuthed() && userHasProduction(prodId)) {
      return { name: 'tenant-home', params: { slug } };
    }
    return true;
  }

  // Require auth → /:slug/login
  if (to.meta?.requiresAuth && !isAuthed()) {
    return { name: 'tenant-login', params: { slug }, query: { r: to.fullPath } };
  }

  // Require membership → /:slug/login (not another slug/home)
  if (to.meta?.requiresMembership && !userHasProduction(prodId)) {
    return { name: 'tenant-login', params: { slug }, query: { r: to.fullPath, err: 'not-authorized' } };
  }

  return true;
});

export default router;


