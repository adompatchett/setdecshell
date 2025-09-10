// server/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import jwt from 'jsonwebtoken';
import User from './models/User.js';

const SECRET = process.env.JWT_SECRET || 'devsecret';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';

export const GOOGLE_ENABLED = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
export const FACEBOOK_ENABLED = !!(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET);

// Helpers to carry slug + return path through OAuth safely
export function encodeState(obj) {
  return jwt.sign(obj, SECRET, { expiresIn: '10m' });
}
export function decodeState(state) {
  try { return jwt.verify(state, SECRET); } catch { return {}; }
}

// ---------------- Google Strategy ----------------
if (GOOGLE_ENABLED) {
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback',
      passReqToCallback: true,
    },
    async (_req, _accessToken, _refreshToken, profile, done) => {
      try {
        const email = (profile.emails?.[0]?.value || '').toLowerCase();
        if (!email) return done(null, false, { message: 'No email on Google profile' });

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            email,
            name: profile.displayName,
            providers: { googleId: profile.id },
            productionIds: [],
          });
        } else if (!user.providers?.googleId) {
          user.providers = { ...(user.providers || {}), googleId: profile.id };
          await user.save();
        }
        return done(null, user);
      } catch (e) {
        return done(e);
      }
    }
  ));
} else {
  console.warn('⚠️ Google OAuth disabled: missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET');
}

// ---------------- Facebook Strategy ----------------
if (FACEBOOK_ENABLED) {
  passport.use(new FacebookStrategy(
    {
      clientID: FACEBOOK_APP_ID,
      clientSecret: FACEBOOK_APP_SECRET,
      callbackURL: '/api/auth/facebook/callback',
      profileFields: ['id', 'displayName', 'emails'],
      passReqToCallback: true,
    },
    async (_req, _accessToken, _refreshToken, profile, done) => {
      try {
        const email = (profile.emails?.[0]?.value || '').toLowerCase();
        if (!email) return done(null, false, { message: 'No email on Facebook profile' });

        let user = await User.findOne({ email });
        if (!user) {
          user = await User.create({
            email,
            name: profile.displayName,
            providers: { facebookId: profile.id },
            productionIds: [],
          });
        } else if (!user.providers?.facebookId) {
          user.providers = { ...(user.providers || {}), facebookId: profile.id };
          await user.save();
        }
        return done(null, user);
      } catch (e) {
        return done(e);
      }
    }
  ));
} else {
  console.warn('⚠️ Facebook OAuth disabled: missing FACEBOOK_APP_ID / FACEBOOK_APP_SECRET');
}

export { passport };
