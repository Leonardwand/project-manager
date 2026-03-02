import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

// Supabase配置
interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// 获取Supabase配置（从环境变量或运行时配置）
function getSupabaseConfig(): SupabaseConfig {
  // 在Vite中，使用import.meta.env访问环境变量
  const url = import.meta.env.VITE_SUPABASE_URL || 
              import.meta.env.COZE_SUPABASE_URL || 
              'https://eenlreciknhwpgbwyegz.supabase.co';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                  import.meta.env.COZE_SUPABASE_ANON_KEY || 
                  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbmxyZWNpa25od3BnYnd5ZWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTM5NDUsImV4cCI6MjA4Nzk2OTk0NX0.Ezpc06Jzoc5pEfAI8mH4C40ulx9HM1BRwwnYM_D3BK0';

  if (!url || !anonKey) {
    console.warn('Supabase配置缺失，云端功能将不可用');
  }

  return { url, anonKey };
}

// 创建Supabase客户端实例
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const { url, anonKey } = getSupabaseConfig();
    
    if (!url || !anonKey) {
      throw new Error('Supabase配置缺失，请设置VITE_SUPABASE_URL和VITE_SUPABASE_ANON_KEY环境变量');
    }
    
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
  
  return supabaseInstance;
}

// 导出supabase实例（用于直接访问）
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabaseClient();
    return client[prop as keyof SupabaseClient];
  }
});

// 认证相关辅助函数
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  const { data } = await client.auth.getUser();
  return data.user;
}

export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data } = await client.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string) {
  const client = getSupabaseClient();
  return client.auth.signInWithPassword({ email, password });
}

export async function signUp(email: string, password: string) {
  const client = getSupabaseClient();
  return client.auth.signUp({ email, password });
}

export async function signOut() {
  const client = getSupabaseClient();
  return client.auth.signOut();
}

// 监听认证状态变化
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
  const client = getSupabaseClient();
  return client.auth.onAuthStateChange(callback);
}
