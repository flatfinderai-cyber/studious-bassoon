import { supabase } from './supabase-client.js';

export async function requireAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    return session;
}

export async function handlePostLogin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, onboarding_complete')
        .eq('id', session.user.id)
        .single();

    if (!profile || !profile.onboarding_complete) {
        window.location.href = '/onboarding-role.html';
        return;
    }

    window.location.href = profile.role === 'landlord' ? '/listings.html' : '/search.html';
}

export async function logOut() {
    await supabase.auth.signOut();
    window.location.href = '/index.html';
}

export function showToast(message, duration = 3000) {
    let toast = document.getElementById('ff-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ff-toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

export function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function clearError(elementId) {
    const el = document.getElementById(elementId);
    if (el) { el.textContent = ''; el.hidden = true; }
}
