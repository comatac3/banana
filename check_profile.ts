
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load env vars
const envLocal = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8')
const envConfig = dotenv.parse(envLocal)

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProfile() {
    console.log('Checking profile for comatac3@gmail.com...')

    // 1. Get User ID
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()

    // Note: admin.listUsers requires service_role key usually, but let's try to see if we can just query profiles directly
    // Actually, we can't list users with anon key.

    // Let's try to sign in with the user credentials if we had them, but we don't.
    // Instead, let's just try to select from profiles where email matches

    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'comatac3@gmail.com')

    if (profileError) {
        console.error('Error fetching profile:', profileError)
    } else {
        console.log('Profiles found:', profiles)
    }
}

checkProfile()
