import { getSupabaseClient } from './supabase-client';
import { Session, User } from '@supabase/supabase-js';

// 生成唯一标识（时间戳 + 随机数）
function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
}

// 数据类型定义
export interface Project {
  id: string;
  user_id: string;
  unique_id: string; // 唯一标识（创建时生成，永不改变）
  name: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  start_date: string | null;
  end_date: string | null;
  progress: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface Todo {
  id: string;
  user_id: string;
  unique_id: string; // 唯一标识（创建时生成，永不改变）
  project_id: string | null;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  progress: string | null;
  end_date: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DeletedTodo extends Todo {
  deleted_at: string;
}

export interface CompletedTodo {
  id: string;
  user_id: string;
  unique_id: string; // 唯一标识（创建时生成，永不改变）
  project_id: string | null;
  text: string;
  priority: 'high' | 'medium' | 'low';
  progress: string | null;
  created_at: string;
  completed_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: 'minimal' | 'cute' | 'business';
  custom_progress_states: Record<string, { label: string; color: string; bg: string }> | null;
  collapsed_groups: string[] | null;
  created_at: string;
  updated_at: string | null;
}

// 认证相关
export async function signUp(email: string, password: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  
  // 创建用户资料
  if (data.user) {
    await client.from('profiles').insert({
      id: data.user.id,
      email: email,
      display_name: email.split('@')[0],
    });
    
    // 创建默认设置
    await client.from('user_settings').insert({
      user_id: data.user.id,
      theme: 'minimal',
      custom_progress_states: {},
      collapsed_groups: [],
    });
  }
  
  return data;
}

export async function signIn(email: string, password: string) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data } = await client.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  const { data } = await client.auth.getUser();
  return data.user;
}

// 项目相关
export async function getProjects(userId: string): Promise<Project[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function createProject(userId: string, project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Project> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .insert({
      user_id: userId,
      ...project,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// 任务相关
export async function getTodos(userId: string): Promise<Todo[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function createTodo(userId: string, todo: Omit<Todo, 'id' | 'user_id' | 'created_at'>): Promise<Todo> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('todos')
    .insert({
      user_id: userId,
      ...todo,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('todos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteTodo(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('todos')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// 回收站相关
export async function getDeletedTodos(userId: string): Promise<DeletedTodo[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('deleted_todos')
    .select('*')
    .eq('user_id', userId)
    .order('deleted_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function createDeletedTodo(userId: string, todo: { unique_id: string } & Partial<Omit<DeletedTodo, 'id' | 'user_id' | 'created_at' | 'deleted_at'>>): Promise<DeletedTodo> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('deleted_todos')
    .insert({
      user_id: userId,
      text: todo.text || '',
      completed: todo.completed ?? false,
      priority: todo.priority || 'medium',
      progress: todo.progress || null,
      end_date: todo.end_date || null,
      project_id: todo.project_id || null,
      completed_at: todo.completed_at || null,
      ...todo,
      created_at: now,
      deleted_at: now,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function addToDeletedTodos(todo: Todo): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('deleted_todos')
    .insert({
      ...todo,
      deleted_at: new Date().toISOString(),
    });
  
  if (error) throw error;
}

export async function restoreFromDeletedTodos(id: string): Promise<Todo> {
  const client = getSupabaseClient();
  
  // 获取回收站中的任务
  const { data: deletedTodo, error: fetchError } = await client
    .from('deleted_todos')
    .select('*')
    .eq('id', id)
    .single();
  
  if (fetchError) throw fetchError;
  
  // 恢复到任务表
  const { error: insertError } = await client
    .from('todos')
    .insert({
      user_id: deletedTodo.user_id,
      project_id: deletedTodo.project_id,
      text: deletedTodo.text,
      completed: deletedTodo.completed,
      priority: deletedTodo.priority,
      progress: deletedTodo.progress,
      end_date: deletedTodo.end_date,
      created_at: deletedTodo.created_at,
      completed_at: deletedTodo.completed_at,
    });
  
  if (insertError) throw insertError;
  
  // 从回收站删除
  const { error: deleteError } = await client
    .from('deleted_todos')
    .delete()
    .eq('id', id);
  
  if (deleteError) throw deleteError;
  
  return deletedTodo;
}

export async function clearDeletedTodos(userId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('deleted_todos')
    .delete()
    .eq('user_id', userId);
  
  if (error) throw error;
}

export async function deleteDeletedTodo(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('deleted_todos')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// 已完成任务相关
export async function getCompletedTodos(userId: string): Promise<CompletedTodo[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('completed_todos')
    .select('*')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function createCompletedTodo(userId: string, todo: Omit<CompletedTodo, 'id' | 'user_id' | 'created_at'>): Promise<CompletedTodo> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('completed_todos')
    .insert({
      user_id: userId,
      ...todo,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function addToCompletedTodos(todo: Todo): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('completed_todos')
    .insert({
      user_id: todo.user_id,
      project_id: todo.project_id,
      text: todo.text,
      priority: todo.priority,
      progress: todo.progress,
      created_at: todo.created_at,
      completed_at: todo.completed_at || new Date().toISOString(),
    });
  
  if (error) throw error;
}

export async function getCompletedTodosByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CompletedTodo[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('completed_todos')
    .select('*')
    .eq('user_id', userId)
    .gte('completed_at', startDate)
    .lte('completed_at', endDate)
    .order('completed_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// 删除已完成任务
export async function deleteCompletedTodo(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('completed_todos')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// 用户设置相关
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('user_settings')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// 迁移localStorage数据到Supabase
export async function migrateLocalDataToSupabase(userId: string) {
  try {
    // 从localStorage读取旧数据
    const localTodos = localStorage.getItem('todo_todos');
    const localProjects = localStorage.getItem('todo_projects');
    const localDeletedTodos = localStorage.getItem('todo_deleted_todos');
    const localCompletedTodos = localStorage.getItem('todo_completed_todos');
    const localTheme = localStorage.getItem('todo_theme');
    const localCollapsed = localStorage.getItem('todo_collapsed');
    const localCustomProgress = localStorage.getItem('todo_custom_progress');
    
    // 迁移项目
    if (localProjects) {
      const projects = JSON.parse(localProjects);
      for (const project of projects) {
        await createProject(userId, {
          unique_id: project.uniqueId || generateUniqueId(),
          name: project.name,
          color: project.color || '#6366F1',
          priority: project.priority || 'medium',
          start_date: project.startDate || null,
          end_date: project.endDate || null,
          progress: project.progress || null,
          completed: project.completed || false,
        });
      }
    }
    
    // 迁移任务
    if (localTodos) {
      const todos = JSON.parse(localTodos);
      for (const todo of todos) {
        await createTodo(userId, {
          unique_id: todo.uniqueId || generateUniqueId(),
          project_id: todo.projectId || null,
          text: todo.text,
          completed: todo.completed || false,
          priority: todo.priority || 'medium',
          progress: todo.progress || null,
          end_date: todo.endDate || null,
          completed_at: todo.completedAt || null,
        });
      }
    }
    
    // 更新用户设置
    const settings: Partial<UserSettings> = {};
    if (localTheme) settings.theme = localTheme as 'minimal' | 'cute' | 'business';
    if (localCollapsed) settings.collapsed_groups = JSON.parse(localCollapsed);
    if (localCustomProgress) settings.custom_progress_states = JSON.parse(localCustomProgress);
    
    if (Object.keys(settings).length > 0) {
      await updateUserSettings(userId, settings);
    }
    
    // 清除localStorage中的旧数据
    localStorage.removeItem('todo_todos');
    localStorage.removeItem('todo_projects');
    localStorage.removeItem('todo_deleted_todos');
    localStorage.removeItem('todo_completed_todos');
    localStorage.removeItem('todo_theme');
    localStorage.removeItem('todo_collapsed');
    localStorage.removeItem('todo_custom_progress');
    localStorage.removeItem('todo_password');
    
    return true;
  } catch (error) {
    console.error('Migration error:', error);
    return false;
  }
}

// 导出migration对象，提供迁移相关方法
export const migration = {
  // 从数组数据迁移到云端（用于首次登录同步）
  migrateToCloud: async (
    projects: any[],
    todos: any[],
    deletedTodos: any[],
    completedTodos: any[],
    settings: any
  ): Promise<boolean> => {
    try {
      const userId = await migration.getCurrentUserId();
      if (!userId) return false;
      
      // 迁移项目
      for (const project of projects) {
        await createProject(userId, {
          unique_id: project.uniqueId || generateUniqueId(),
          name: project.name,
          color: project.color || '#6366F1',
          priority: project.priority || 'medium',
          start_date: project.startDate || project.start_date || null,
          end_date: project.endDate || project.end_date || null,
          progress: project.progress || null,
          completed: project.completed || false,
        });
      }
      
      // 迁移任务
      for (const todo of todos) {
        await createTodo(userId, {
          unique_id: todo.uniqueId || generateUniqueId(),
          project_id: todo.projectId || todo.project_id || null,
          text: todo.text,
          completed: todo.completed || false,
          priority: todo.priority || 'medium',
          progress: todo.progress || null,
          end_date: todo.endDate || todo.end_date || null,
          completed_at: todo.completedAt || todo.completed_at || null,
        });
      }
      
      // 迁移已删除任务
      for (const todo of deletedTodos) {
        await createDeletedTodo(userId, {
          unique_id: todo.uniqueId || generateUniqueId(),
          project_id: todo.projectId || todo.project_id || null,
          text: todo.text,
          completed: todo.completed || false,
          priority: todo.priority || 'medium',
          progress: todo.progress || null,
          end_date: todo.endDate || todo.end_date || null,
          completed_at: todo.completedAt || todo.completed_at || null,
        });
      }
      
      // 迁移已完成任务（工作总结）
      for (const todo of completedTodos) {
        await createCompletedTodo(userId, {
          unique_id: todo.uniqueId || generateUniqueId(),
          project_id: todo.projectId || todo.project_id || null,
          text: todo.text,
          priority: todo.priority || 'medium',
          progress: todo.progress || null,
          completed_at: todo.completedAt || todo.completed_at || new Date().toISOString(),
        });
      }
      
      // 更新用户设置
      if (settings && Object.keys(settings).length > 0) {
        const updateData: Partial<UserSettings> = {};
        if (settings.theme) updateData.theme = settings.theme;
        if (settings.collapsed_groups) updateData.collapsed_groups = settings.collapsed_groups;
        if (settings.custom_progress_states) updateData.custom_progress_states = settings.custom_progress_states;
        
        if (Object.keys(updateData).length > 0) {
          await updateUserSettings(userId, updateData);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Migration to cloud error:', error);
      return false;
    }
  },
  
  // 获取当前用户ID
  getCurrentUserId: async (): Promise<string | null> => {
    const client = getSupabaseClient();
    const { data } = await client.auth.getUser();
    return data.user?.id || null;
  },
  
  // 原有的localStorage迁移方法
  migrateLocalDataToSupabase
};

// 导出dataService对象
export const dataService = {
  auth: {
    signUp,
    signIn,
    signOut,
    getSession,
    getCurrentUser,
  },
  projects: {
    getProjects,
    createProject,
    updateProject,
    deleteProject,
  },
  todos: {
    getTodos,
    createTodo,
    updateTodo,
    deleteTodo,
  },
  deletedTodos: {
    getDeletedTodos,
    createDeletedTodo,
    deleteDeletedTodo,
    clearDeletedTodos,
  },
  completedTodos: {
    getCompletedTodos,
    createCompletedTodo,
    getCompletedTodosByDateRange,
    deleteCompletedTodo,
  },
  settings: {
    getUserSettings,
    updateUserSettings,
  },
  migration,
};
