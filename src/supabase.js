import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  'https://nonmknuojmcqndmlxjhz.supabase.co',
  'sb_publishable_A9nrrYe8B1A0A0lbL-Zl9Q_mIzWnMXx',
  {auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}}
);
async function checkUser(id) {
  const {data,error}=await supabase.auth.getSession();
  if(error)throw error;
  if(data.session?.user.id!==id)throw new Error('account_changed');
}
export const repository={
  async load(id){
    await checkUser(id);
    const {data,error}=await supabase.rpc('load_padel_session',{p_user_id:id});
    if(error)throw error;return data;
  },
  async save(state,revision,id){
    await checkUser(id);
    const {data,error}=await supabase.rpc('save_padel_session',{p_state:state,p_expected_revision:revision,p_user_id:id});
    if(error)throw error;return data;
  }
};
export function watchSession(id,onChange,onConnection) {
  const channel=supabase.channel(`padel:${id}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'sessions',filter:`owner_id=eq.${id}`},onChange)
    .subscribe(status=>{onConnection(status);if(status==='SUBSCRIBED')onChange();});
  return ()=>void supabase.removeChannel(channel);
}
export async function signIn() {
  const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('/',window.location.href).href}});
  if(error)throw error;
}
