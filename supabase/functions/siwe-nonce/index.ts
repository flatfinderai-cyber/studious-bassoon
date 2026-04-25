import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { address } = await req.json();

        if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
            return new Response(JSON.stringify({ error: 'Invalid Ethereum address' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const issuedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const { error } = await supabase
            .from('siwe_nonces')
            .insert({ nonce, address: address.toLowerCase(), expires_at: expiresAt });

        if (error) throw error;

        const message = [
            'flatfinder.app wants you to sign in with your Ethereum account:',
            address,
            '',
            'Sign in to FlatFinder — Housing Revolutionised.',
            '',
            'URI: https://flatfinder.app',
            'Version: 1',
            'Chain ID: 1',
            `Nonce: ${nonce}`,
            `Issued At: ${issuedAt}`,
            `Expiration Time: ${expiresAt}`,
        ].join('\n');

        return new Response(JSON.stringify({ nonce, message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('siwe-nonce error:', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
