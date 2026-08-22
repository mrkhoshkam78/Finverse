/**
 * Finverse Auth — Supabase (Anon/Publishable key only)
 * Modular: ready for watchlist, preferences, premium later
 */
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://vjtnysoivxpmngnpbhfd.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_-oOZ9oxvQI3Erfqskff6Jw_DQ1cyzpN';

  var client = null;
  var state = {
    user: null,
    profile: null,
    loading: true,
    error: null
  };
  var listeners = [];

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error(e); }
    });
  }

  function onAuthChange(fn) {
    listeners.push(fn);
    fn(state);
    return function () {
      listeners = listeners.filter(function (x) { return x !== fn; });
    };
  }

  function getClient() {
    if (client) return client;
    if (!global.supabase || !global.supabase.createClient) {
      throw new Error('Supabase SDK not loaded');
    }
    client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: global.localStorage
      }
    });
    return client;
  }

  function mapError(err) {
    if (!err) return 'خطای ناشناخته';
    var msg = err.message || String(err);
    if (/invalid login credentials/i.test(msg)) return 'ایمیل یا رمز عبور نادرست است';
    if (/email not confirmed/i.test(msg)) return 'ایمیل هنوز تأیید نشده است';
    if (/already registered|already exists/i.test(msg)) return 'این ایمیل قبلاً ثبت شده است';
    if (/password/i.test(msg) && /least/i.test(msg)) return 'رمز عبور باید حداقل ۶ کاراکتر باشد';
    if (/valid email/i.test(msg)) return 'فرمت ایمیل معتبر نیست';
    if (/network|fetch/i.test(msg)) return 'خطای شبکه — اتصال اینترنت را بررسی کنید';
    return msg;
  }

  async function ensureProfile(user) {
    if (!user) return null;
    var sb = getClient();
    var existing = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (existing.data) {
      state.profile = existing.data;
      return existing.data;
    }
    // create profile row (RLS: user can insert own)
    var payload = {
      id: user.id,
      email: user.email,
      display_name: (user.user_metadata && user.user_metadata.display_name) || (user.email || '').split('@')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    var ins = await sb.from('profiles').upsert(payload, { onConflict: 'id' }).select().maybeSingle();
    if (ins.error) {
      console.warn('[Auth] profile upsert', ins.error.message);
      state.profile = payload;
      return payload;
    }
    state.profile = ins.data || payload;
    return state.profile;
  }

  async function init() {
    state.loading = true;
    state.error = null;
    emit();
    try {
      var sb = getClient();
      var sessionRes = await sb.auth.getSession();
      var session = sessionRes.data && sessionRes.data.session;
      state.user = session ? session.user : null;
      if (state.user) await ensureProfile(state.user);

      sb.auth.onAuthStateChange(function (event, session) {
        state.user = session ? session.user : null;
        if (state.user) {
          ensureProfile(state.user).then(function () { state.loading = false; emit(); });
        } else {
          state.profile = null;
          state.loading = false;
          emit();
        }
      });
    } catch (e) {
      state.error = mapError(e);
      console.error('[Auth] init', e);
    }
    state.loading = false;
    emit();
  }

  async function signUp(email, password, displayName) {
    state.loading = true;
    state.error = null;
    emit();
    try {
      var sb = getClient();
      var res = await sb.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { display_name: displayName || email.split('@')[0] }
        }
      });
      if (res.error) throw res.error;
      state.user = res.data.user;
      if (state.user) await ensureProfile(state.user);
      state.loading = false;
      emit();
      return { ok: true, user: state.user, needsEmailConfirm: !!(res.data.user && !res.data.session) };
    } catch (e) {
      state.loading = false;
      state.error = mapError(e);
      emit();
      return { ok: false, error: state.error };
    }
  }

  async function signIn(email, password) {
    state.loading = true;
    state.error = null;
    emit();
    try {
      var sb = getClient();
      var res = await sb.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      state.user = res.data.user;
      if (state.user) await ensureProfile(state.user);
      state.loading = false;
      emit();
      return { ok: true, user: state.user };
    } catch (e) {
      state.loading = false;
      state.error = mapError(e);
      emit();
      return { ok: false, error: state.error };
    }
  }

  async function signOut() {
    state.loading = true;
    emit();
    try {
      var sb = getClient();
      await sb.auth.signOut();
      state.user = null;
      state.profile = null;
    } catch (e) {
      state.error = mapError(e);
    }
    state.loading = false;
    emit();
  }

  function isLoggedIn() {
    return !!state.user;
  }

  global.FinverseAuth = {
    init: init,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    onAuthChange: onAuthChange,
    isLoggedIn: isLoggedIn,
    getState: function () { return state; },
    getClient: getClient
  };
})(typeof window !== 'undefined' ? window : globalThis);
