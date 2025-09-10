import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import Production, { normalizeSlug } from './models/Production.js';
import tenantRouter from './routes/tenant.js';
import { authRequired } from './middleware/auth.js';
import { requireMembership } from './middleware/requireMembership.js';
import authRouter from './routes/auth.js';
import cookieParser from 'cookie-parser';
import { passport } from './passport.js';
import User from './models/User.js';

const app = express();

// --- Stripe ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY in environment (.env).');
}
const stripe = new Stripe(STRIPE_SECRET_KEY); // optionally: { apiVersion: '2024-06-20' }

// --- CORS ---
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: [ORIGIN],
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-production-id'],
  credentials: false
}));

app.use(cookieParser());
app.use(passport.initialize());

app.use('/api/tenant', authRequired, requireMembership, tenantRouter);


// Webhook MUST use raw body (and be registered BEFORE express.json)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let evt;
  try {
    evt = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verify failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (evt.type === 'checkout.session.completed') {
    const session = evt.data.object;
    const meta = session.metadata || {};
    const title = meta.title || 'Production';
    const slug  = normalizeSlug(meta.desiredSlug || title);
    const currency = (session.currency ?? process.env.CURRENCY) || 'usd';

    // Upsert production
    const prod = await Production.findOneAndUpdate(
      { slug },
      {
        $setOnInsert: {
          title,
          slug,
          stripe: {
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent,
            amount: session.amount_total ?? null,
            currency,
          },
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const user = await User.findOneAndUpdate(
  { email: emailLC },
  { $setOnInsert: { email: emailLC }, $addToSet: { productionIds: prod._id } },
  { upsert: true, new: true }
);

// if this production has no owner yet, make this purchaser the owner
if (!prod.ownerUserId) {
  prod.ownerUserId = user._id;
  await prod.save();
}

    // Attach purchaser to user.productionIds
    let email = session?.customer_details?.email || session?.customer_email || null;
    if (!email && session.customer) {
      try {
        const cust = await stripe.customers.retrieve(session.customer);
        email = cust?.email || null;
      } catch {}
    }
    if (email) {
      const emailLC = String(email).toLowerCase();
      await User.findOneAndUpdate(
        { email: emailLC },
        { $setOnInsert: { email: emailLC }, $addToSet: { productionIds: prod._id } },
        { upsert: true, new: true }
      );
    } else {
      console.warn('Checkout completed but no customer email found; cannot attach user membership.');
    }
  }

  // ✅ Only respond once
  res.json({ received: true });
});

// JSON parser AFTER webhook
app.use(express.json());
app.use(morgan('dev'));

// --- Mongo ---
await mongoose.connect(process.env.MONGODB_URI);

app.use('/api/auth', authRouter);

// --- Health ---
app.get('/api/health', (req, res) => res.json({ ok: true }));

// --- Public: resolve by slug ---
app.get('/api/productions/by-slug/:slug', async (req, res) => {
  const slug = normalizeSlug(req.params.slug || '');
  const prod = await Production.findOne({ slug, isActive: true }).select('_id title slug').lean();
  if (!prod) return res.status(404).json({ error: 'Production not found' });
  res.json(prod);
});

app.get('/api/stripe/check', async (req, res) => {
  try {
    const account = await stripe.accounts.retrieve();
    res.json({ ok: true, account: account.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

 

// Create Checkout Session
app.post('/api/checkout/session', async (req, res) => {
  try {
    const { title, desiredSlug } = req.body || {};
    const cleanTitle = String(title || '').trim();
    const slug = normalizeSlug(desiredSlug || cleanTitle);

    if (!cleanTitle) return res.status(400).json({ error: 'Title required' });
    if (!slug) return res.status(400).json({ error: 'Slug required' });

    // Ensure slug not already taken
    const exists = await Production.exists({ slug });
    if (exists) return res.status(409).json({ error: 'Slug already in use' });

    const price = parseInt(process.env.PRICE_CENTS || '9900', 10);
    const currency = (process.env.CURRENCY || 'usd').toLowerCase();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: `${ORIGIN}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/?canceled=1`,
      customer_creation: 'always', // ensure we capture email
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          product_data: { name: `Set-Dec Production: ${cleanTitle}` },
          unit_amount: price,
        },
      }],
      metadata: { title: cleanTitle, desiredSlug: slug },
    });

    return res.json({ url: session.url });
  } catch (e) {
    const detail = e?.raw || e;
    console.error('Create Checkout Session error:', {
      type: detail?.type,
      code: detail?.code,
      message: detail?.message || e?.message,
    });
    return res.status(e?.statusCode || 500).json({
      error: detail?.message || 'Failed to create checkout session',
      code: detail?.code || undefined,
    });
  }
});



// --- Lookup session / resolve slug after payment ---
app.get('/api/checkout/sessions/:id', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id);
    const meta = session.metadata || {};
    const title = meta.title || 'Production';
    const slug  = normalizeSlug(meta.desiredSlug || title);

    // ensure Production exists (your existing fallback)
    const currency = (session.currency ?? process.env.CURRENCY) || 'usd';
    const prod = await Production.findOneAndUpdate(
      { slug },
      {
        $setOnInsert: {
          title, slug,
          stripe: {
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent,
            amount: session.amount_total ?? null,
            currency,
          },
          isActive: true,
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // ⬇️ Attach user membership by purchaser email
    const email =
      session?.customer_details?.email ||
      session?.customer_email ||
      null;

    if (email) {
      const emailLC = String(email).toLowerCase();
      await User.findOneAndUpdate(
        { email: emailLC },
        { $setOnInsert: { email: emailLC }, $addToSet: { productionIds: prod._id } },
        { upsert: true }
      );
    }

    res.json({
      status: session.status,
      payment_status: session.payment_status,
      slug: prod.slug,
      title: prod.title,
    });
  } catch (e) {
    res.status(404).json({ error: 'Session not found' });
  }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
