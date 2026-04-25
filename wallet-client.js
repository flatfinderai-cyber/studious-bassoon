import { createWalletClient, custom } from 'https://esm.sh/viem@2';
import { mainnet } from 'https://esm.sh/viem@2/chains';

const SUPABASE_URL = 'https://ygdmttxegqiqzdiumaif.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZG10dHhlZ3FpcXpkaXVtYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDczNTksImV4cCI6MjA4NzE4MzM1OX0.Rj09RopXbaKPg_ppJTZ0O5yn56ohstpbu8fKipcCIIU';

/**
 * Full SIWE sign-in flow:
 * 1. Request wallet connection (window.ethereum / EIP-1193)
 * 2. Fetch nonce + EIP-4361 message from Edge Function
 * 3. Prompt wallet signature
 * 4. Verify on server → receive Supabase magic link
 * 5. Navigate to magic link → auth-callback.html completes session
 *
 * @param {function(string): void} onError  — called with a user-facing error message
 * @param {function(): void} onPending      — called when wallet popup is open (optional)
 */
export async function siweSignIn(onError, onPending = () => {}) {
    if (!window.ethereum) {
        onError('No wallet detected. Please install MetaMask or a browser wallet to continue.');
        return;
    }

    // Request account access
    let address;
    try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        address = accounts[0];
        if (!address) throw new Error('No account returned');
    } catch (e) {
        if (e.code === 4001) {
            onError('Wallet connection cancelled.');
        } else {
            onError('Could not connect to wallet. Please try again.');
        }
        return;
    }

    onPending();

    // Fetch nonce + EIP-4361 message
    let message;
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/siwe-nonce`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ address }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || 'Nonce request failed');
        message = data.message;
    } catch {
        onError('Failed to start wallet sign-in. Please try again.');
        return;
    }

    // Sign the SIWE message
    let signature;
    try {
        const client = createWalletClient({ chain: mainnet, transport: custom(window.ethereum) });
        const [account] = await client.getAddresses();
        signature = await client.signMessage({ account, message });
    } catch (e) {
        if (e.code === 4001 || e?.message?.includes('User rejected') || e?.message?.includes('user rejected')) {
            onError('Signature cancelled.');
        } else {
            onError('Signing failed. Please try again.');
        }
        return;
    }

    // Verify signature → receive Supabase action link
    let url;
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/siwe-verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ message, signature, address }),
        });
        const data = await res.json();
        if (!res.ok || data.error || !data.url) throw new Error(data.error || 'Verification failed');
        url = data.url;
    } catch {
        onError('Sign-in failed. Please try again.');
        return;
    }

    window.location.href = url;
}
