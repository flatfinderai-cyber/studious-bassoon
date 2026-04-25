import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyMessage } from 'https://esm.sh/viem@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ORIGINS = new Set([
    'https://flatfinder.app',
    'https://www.flatfinder.app',
]);

function trustedOrigin(req: Request): string {
    const o = req.headers.get('origin') ?? '';
    return ALLOWED_ORIGINS.has(o) ? o : 'https://flatfinder.app';
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { message, signature, address } = await req.json();

        if (!message || !signature || !address) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verify the signature recovers to the claimed address
        const isValid = await verifyMessage({
            address: address as `0x${string}`,
            message,
            signature: signature as `0x${string}`,
        });

        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Extract nonce from EIP-4361 message
        const nonceMatch = message.match(/^Nonce: (.+)$/m);
        if (!nonceMatch) {
            return new Response(JSON.stringify({ error: 'Nonce not found in message' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const nonce = nonceMatch[1];

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Validate nonce: exists, matches address, not expired, not used
        const { data: nonceRow, error: nonceErr } = await supabase
            .from('siwe_nonces')
            .select('*')
            .eq('nonce', nonce)
            .eq('address', address.toLowerCase())
            .single();

        if (nonceErr || !nonceRow) {
            return new Response(JSON.stringify({ error: 'Invalid nonce' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (nonceRow.used || new Date(nonceRow.expires_at) < new Date()) {
            return new Response(JSON.stringify({ error: 'Nonce expired or already used' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Mark nonce as used
        await supabase.from('siwe_nonces').update({ used: true }).eq('nonce', nonce);

        // Wallet address uses a synthetic email for Supabase Auth
        const walletEmail = address.toLowerCase() + '@wallet.flatfinder.app';

        // Check if a user already exists for this wallet address via profiles lookup
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('wallet_address', address.toLowerCase())
            .single();

        let userId: string;

        if (!existingProfile) {
            // Create new user with wallet_address in metadata (trigger will set profile)
            const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
                email: walletEmail,
                email_confirm: true,
                user_metadata: {
                    wallet_address: address,
                    full_name: address.slice(0, 6) + '…' + address.slice(-4),
                },
            });
            if (createErr) throw createErr;
            userId = newUser.user!.id;
        } else {
            userId = existingProfile.id;
        }

        // Generate a magic link so the frontend can exchange it for a session
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: walletEmail,
            options: { redirectTo: `${trustedOrigin(req)}/auth-callback.html` },
        });

        if (linkErr) throw linkErr;

        return new Response(JSON.stringify({ url: linkData.properties.action_link }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('siwe-verify error:', err);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
