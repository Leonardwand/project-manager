export function initApp(): void {
  const app = document.getElementById('app');

  if (!app) {
    console.error('App element not found');
    return;
  }

  // 自动同步定时器
  let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let isSyncing = false; // 同步中标志，防止重复同步
  
  // 防抖同步函数 - 在操作后自动同步到云端
  async function debouncedSyncToCloud() {
    if (isSyncing) {
      console.log('同步进行中，跳过');
      return;
    }
    if (autoSyncTimer) {
      clearTimeout(autoSyncTimer);
    }
    autoSyncTimer = setTimeout(async () => {
      if (todoApp.isCloudMode() && !isSyncing) {
        console.log('自动同步到云端...');
        isSyncing = true;
        try {
          await syncLocalToCloud();
          console.log('自动同步完成');
        } catch (e) {
          console.error('自动同步失败:', e);
        } finally {
          isSyncing = false;
        }
      }
    }, 1000); // 1秒后同步
  }

  // 定义主题样式 - 莫兰迪低饱和色系
  const themes = {
    minimal: {
      name: '简约风格',
      primary: '#6366F1',
      primaryLight: '#EEF2FF',
      primaryDark: '#4F46E5',
      background: '#F8FAFB',
      cardBg: '#FFFFFF',
      textColor: '#1F2937',
      textColorLight: '#6B7280',
      borderRadius: '16px',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
      shadowHover: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      gradient: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
      accent: '#6366F1',
    },
    cute: {
      name: '可爱风格',
      primary: '#F687B3',
      primaryLight: '#FED7E2',
      primaryDark: '#D53F8C',
      background: '#FFFBFC',
      cardBg: '#FFFFFF',
      textColor: '#553C4D',
      textColorLight: '#9F7AAA',
      borderRadius: '20px',
      shadow: '0 4px 12px rgba(214, 51, 108, 0.1)',
      shadowHover: '0 8px 24px rgba(214, 51, 108, 0.15)',
      gradient: 'linear-gradient(135deg, #FFE5EC 0%, #FFF5F7 50%, #FFE8F0 100%)',
      accent: '#F687B3',
    },
    business: {
      name: '商务风格',
      primary: '#2B6CB0',
      primaryLight: '#EBF4FF',
      primaryDark: '#1A365D',
      background: '#F7FAFC',
      cardBg: '#FFFFFF',
      textColor: '#1A202C',
      textColorLight: '#4A5568',
      borderRadius: '10px',
      shadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
      shadowHover: '0 4px 12px rgba(0, 0, 0, 0.12)',
      gradient: 'linear-gradient(135deg, #EBF4FF 0%, #F0FFF4 50%, #FFF5F5 100%)',
      accent: '#2B6CB0',
    },
  };

  // 优先级配置 - 莫兰迪色系
  const priorityConfig = {
    high: { label: '高', color: '#E53E3E', bg: '#FED7D7' },
    medium: { label: '中', color: '#D69E2E', bg: '#FEFCBF' },
    low: { label: '低', color: '#38A169', bg: '#C6F6D5' },
  };

  // 进展状态配置 - 莫兰迪色系
  const defaultProgressConfig: Record<string, { label: string; color: string; bg: string }> = {
    'not-started': { label: '未开始', color: '#718096', bg: '#E2E8F0' },
    'in-progress': { label: '进行中', color: '#4A90E2', bg: '#BEE3F8' },
    'paused': { label: '暂停', color: '#D69E2E', bg: '#FEFCBF' },
    'completed': { label: '已完成', color: '#38A169', bg: '#C6F6D5' },
  };

  // 获取进展状态配置（合并自定义状态）
  function getProgressConfig(customStates: Record<string, { label: string; color: string; bg: string }> = {}): Record<string, { label: string; color: string; bg: string }> {
    return { ...defaultProgressConfig, ...customStates };
  }

  // 辅助函数：判断任务是否已完成（根据 completed 字段或 progress 状态）
  function isTodoCompleted(todo: Todo): boolean {
    // 如果 completed 字段为 true，则认为已完成
    if (todo.completed) return true;
    // 如果 progress 状态为 'completed'，也认为已完成
    if (todo.progress === 'completed') return true;
    return false;
  }

  // 辅助函数：比较ID（考虑浮点数精度问题）
  function isIdEqual(id1: number | null | undefined, id2: number | null | undefined): boolean {
    if (id1 === null || id1 === undefined || id2 === null || id2 === undefined) return false;
    if (id1 === id2) return true;
    // 处理浮点数精度问题，如果两个ID非常接近，认为是相同的
    return Math.abs(id1 - id2) < 1;
  }

  // 辅助函数：获取本地日期字符串（YYYY-MM-DD格式），避免时区问题
  function getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 排序类型
  type SortType = 'project' | 'priority' | 'created' | 'deadline';

  // 生成唯一标识（时间戳 + 随机数）
  function generateUniqueId(): string {
    const timestamp = Date.now().toString(36); // 时间戳转36进制
    const randomPart = Math.random().toString(36).substring(2, 10); // 随机部分
    return `${timestamp}-${randomPart}`;
  }

  // 接口定义
  interface Todo {
    id: number;
    uniqueId: string; // 唯一标识（创建时生成，永不改变）
    cloudId?: string; // 云端ID（用于同步）
    text: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string; // 更新时间
    projectId: number | null;
    projectCloudId?: string; // 项目云端ID
    progress: string; // 改为string支持自定义状态
    priority: 'high' | 'medium' | 'low';
    deadline: string | null;
    startDate: string | null; // 开始日期（自动设为创建日期）
    endDate: string | null; // 计划完成日期（可选）
    completedAt?: string; // 完成时间（归档时间）
    deletedAt?: string;
    deletedFromProject?: string; // 被删除时所属的项目名称
    originalProjectId?: number; // 原项目ID（用于恢复）
    originalProjectColor?: string; // 原项目颜色（用于恢复）
  }

  interface Project {
    id: number;
    uniqueId: string; // 唯一标识（创建时生成，永不改变）
    cloudId?: string; // 云端ID（用于同步）
    name: string;
    color: string;
    priority: 'high' | 'medium' | 'low'; // 项目优先级
    startDate: string | null; // 开始日期
    endDate: string | null; // 计划完成日期
    progress: string; // 当前进度（自由文本）
    completed: boolean; // 是否已完结
    updatedAt: string; // 更新时间
  }

  // 项目优先级配置
  const projectPriorityConfig = {
    high: { label: '高', color: '#EF4444', bg: '#FEE2E2' },
    medium: { label: '中', color: '#F59E0B', bg: '#FEF3C7' },
    low: { label: '低', color: '#10B981', bg: '#D1FAE5' },
  };

  // 数据管理类
  class TodoApp {
    private todos: Todo[] = [];
    private deletedTodos: Todo[] = []; // 回收站（被删除的任务）
    private completedTodos: Todo[] = []; // 工作总结（已完成的任务）
    private projects: Project[] = [];
    private customProgressStates: Record<string, { label: string; color: string; bg: string }> = {};
    private currentTheme: keyof typeof themes = 'minimal';
    private isLoggedIn: boolean = false;
    private password: string = '';
    private filter: 'all' | 'completed' | 'pending' = 'all';
    private projectFilter: number | 'all' | 'uncategorized' = 'all';
    private sortBy: SortType = 'project';
    private collapsedGroups: Set<string> = new Set();
    private cloudMode: boolean = false;
    private cloudUserId: string = '';
    private deletedProjectNames: string[] = []; // 记录已删除的项目名称（用于云端同步删除）
    private onSaveCallback: (() => void) | null = null; // 保存后的回调函数
    private skipSyncCallback: boolean = false; // 跳过同步回调标志（用于同步过程中避免无限循环）
    private batchModeProjectId: number | null | 'all' | 'none' = 'none'; // 当前批量选择的项目ID，'none'表示未开启，'all'表示全部项目模式
    private selectedTodoIds: Set<number> = new Set(); // 选中的任务 ID 集合

    constructor() {
      this.loadFromStorage();
      this.checkLogin();
      this.checkCloudMode();
    }

    // 辅助方法：比较ID（考虑浮点数精度问题）
    private isIdEqual(id1: number | null | undefined, id2: number | null | undefined): boolean {
      if (id1 === null || id1 === undefined || id2 === null || id2 === undefined) return false;
      if (id1 === id2) return true;
      // 处理浮点数精度问题，如果两个ID非常接近，认为是相同的
      return Math.abs(id1 - id2) < 1;
    }
    
    // 设置保存后的回调
    setOnSaveCallback(callback: () => void) {
      this.onSaveCallback = callback;
    }
    
    // 设置跳过同步回调标志
    setSkipSyncCallback(skip: boolean) {
      this.skipSyncCallback = skip;
    }
    
    // 设置云端模式
    setCloudMode(enabled: boolean, userId: string = '') {
      this.cloudMode = enabled;
      this.cloudUserId = userId;
      if (enabled) {
        this.isLoggedIn = true;
        localStorage.setItem('cloud_mode', 'true');
        localStorage.setItem('cloud_user_id', userId);
      } else {
        localStorage.removeItem('cloud_mode');
        localStorage.removeItem('cloud_user_id');
      }
    }
    
    // 检查是否云端模式（从 localStorage 恢复）
    checkCloudMode(): void {
      const stored = localStorage.getItem('cloud_mode');
      if (stored === 'true') {
        this.cloudMode = true;
        this.cloudUserId = localStorage.getItem('cloud_user_id') || '';
        this.isLoggedIn = true;
      }
    }
    
    // 检查是否云端模式
    isCloudMode(): boolean {
      return this.cloudMode;
    }
    
    // 获取云端用户ID
    getCloudUserId(): string {
      return this.cloudUserId;
    }

    private loadFromStorage() {
      const storedPassword = localStorage.getItem('todo_password');
      const storedTodos = localStorage.getItem('todo_todos');
      const storedDeletedTodos = localStorage.getItem('todo_deleted_todos');
      const storedCompletedTodos = localStorage.getItem('todo_completed_todos');
      const storedProjects = localStorage.getItem('todo_projects');
      const storedCollapsed = localStorage.getItem('todo_collapsed');
      const storedTheme = localStorage.getItem('todo_theme') as keyof typeof themes;
      const storedCustomProgress = localStorage.getItem('todo_custom_progress');
      const storedDeletedProjectNames = localStorage.getItem('todo_deleted_project_names');

      this.password = storedPassword || '123456';
      
      if (storedTodos) {
        const parsedTodos = JSON.parse(storedTodos);
        // 兼容旧数据格式，添加 uniqueId
        this.todos = parsedTodos.map((t: any) => ({
          id: t.id,
          uniqueId: t.uniqueId || generateUniqueId(), // 兼容旧数据，自动生成唯一标识
          text: t.text,
          completed: t.completed,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt || t.createdAt, // 兼容旧数据
          projectId: t.projectId ?? null,
          progress: t.progress ?? 'not-started',
          priority: t.priority ?? 'medium',
          deadline: t.deadline ?? null,
          endDate: t.endDate ?? null,
          startDate: t.startDate ?? null,
        }));
      }
      
      if (storedDeletedTodos) {
        this.deletedTodos = JSON.parse(storedDeletedTodos).map((t: any) => ({
          ...t,
          uniqueId: t.uniqueId || generateUniqueId(), // 兼容旧数据
          updatedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
        }));
      }
      
      if (storedCompletedTodos) {
        this.completedTodos = JSON.parse(storedCompletedTodos).map((t: any) => ({
          ...t,
          uniqueId: t.uniqueId || generateUniqueId(), // 兼容旧数据
          updatedAt: t.updatedAt || t.completedAt || t.createdAt || new Date().toISOString(),
        }));
      }
      
      if (storedProjects) {
        const parsedProjects = JSON.parse(storedProjects);
        // 兼容旧数据格式，添加默认值和 uniqueId
        this.projects = parsedProjects.map((p: any) => ({
          id: p.id,
          uniqueId: p.uniqueId || generateUniqueId(), // 兼容旧数据，自动生成唯一标识
          name: p.name,
          color: p.color,
          priority: p.priority || 'medium',
          startDate: p.startDate || null,
          endDate: p.endDate || null,
          progress: p.progress || '',
          completed: p.completed || false,
          updatedAt: p.updatedAt || new Date().toISOString(),
        }));
      } else {
        // 不预设项目，让用户自己创建
        this.projects = [];
      }
      
      if (storedCollapsed) {
        this.collapsedGroups = new Set(JSON.parse(storedCollapsed));
      }
      
      if (storedTheme && themes[storedTheme]) {
        this.currentTheme = storedTheme;
      }

      if (storedCustomProgress) {
        this.customProgressStates = JSON.parse(storedCustomProgress);
      }

      if (storedDeletedProjectNames) {
        this.deletedProjectNames = JSON.parse(storedDeletedProjectNames);
      }
    }

    private saveToStorage() {
      localStorage.setItem('todo_todos', JSON.stringify(this.todos));
      localStorage.setItem('todo_deleted_todos', JSON.stringify(this.deletedTodos));
      localStorage.setItem('todo_completed_todos', JSON.stringify(this.completedTodos));
      localStorage.setItem('todo_projects', JSON.stringify(this.projects));
      localStorage.setItem('todo_theme', this.currentTheme);
      localStorage.setItem('todo_collapsed', JSON.stringify([...this.collapsedGroups]));
      localStorage.setItem('todo_custom_progress', JSON.stringify(this.customProgressStates));
      localStorage.setItem('todo_deleted_project_names', JSON.stringify(this.deletedProjectNames));
      
      // 触发保存后的回调（用于自动同步到云端）
      // 如果 skipSyncCallback 为 true 则跳过（避免同步过程中的无限循环）
      if (this.onSaveCallback && !this.skipSyncCallback) {
        this.onSaveCallback();
      }
    }

    // 重新加载数据（同步后使用）
    reloadData() {
      console.log('reloadData: 重新从 localStorage 加载数据');
      this.loadFromStorage();
      console.log('reloadData: 加载后项目数量:', this.projects.length, '项目:', this.projects.map(p => p.name));
    }

    // 获取自定义进展状态
    getCustomProgressStates(): Record<string, { label: string; color: string; bg: string }> {
      return this.customProgressStates;
    }

    // 添加自定义进展状态
    addCustomProgressState(key: string, label: string, color: string, bg: string) {
      this.customProgressStates[key] = { label, color, bg };
      this.saveToStorage();
    }

    // 删除自定义进展状态
    removeCustomProgressState(key: string) {
      delete this.customProgressStates[key];
      this.saveToStorage();
    }

    private checkLogin() {
      // 使用 localStorage 持久化登录状态
      const loggedIn = localStorage.getItem('todo_logged_in');
      this.isLoggedIn = loggedIn === 'true';
    }

    login(password: string): boolean {
      if (password === this.password) {
        this.isLoggedIn = true;
        localStorage.setItem('todo_logged_in', 'true');
        return true;
      }
      return false;
    }

    logout() {
      this.isLoggedIn = false;
      this.cloudMode = false;
      this.cloudUserId = '';
      localStorage.removeItem('todo_logged_in');
      // 清除云端登录状态
      localStorage.removeItem('cloud_user');
      localStorage.removeItem('cloud_mode');
      localStorage.removeItem('cloud_user_id');
      localStorage.removeItem('cloud_session');
    }

    changePassword(oldPassword: string, newPassword: string): boolean {
      if (oldPassword === this.password) {
        this.password = newPassword;
        localStorage.setItem('todo_password', newPassword);
        return true;
      }
      return false;
    }

    // 生成不重复的项目颜色
    private generateUniqueColor(): string {
      // 预设的丰富颜色列表（扩展到40种）
      const presetColors = [
        // 蓝色系
        '#4A90E2', '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF',
        // 绿色系
        '#48BB78', '#38A169', '#10B981', '#059669', '#047857',
        // 橙色/黄色系
        '#ED8936', '#DD6B20', '#F59E0B', '#D97706', '#B45309',
        // 红色系
        '#E53E3E', '#DC2626', '#B91C1C', '#EF4444', '#F87171',
        // 紫色系
        '#9F7AEA', '#805AD5', '#7C3AED', '#6D28D9', '#A78BFA',
        // 青色系
        '#38B2AC', '#319795', '#14B8A6', '#0D9488', '#2DD4BF',
        // 粉色系
        '#F687B3', '#ED64A6', '#EC4899', '#DB2777', '#F472B6',
        // 其他
        '#667EEA', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
      ];
      
      // 获取已使用的颜色（忽略已完结的项目）
      const activeProjects = this.projects.filter(p => !p.completed);
      const usedColors = new Set(activeProjects.map(p => p.color.toUpperCase()));
      
      // 找到第一个未使用的颜色
      for (let i = 0; i < presetColors.length; i++) {
        const color = presetColors[i];
        const colorUpper = color.toUpperCase();
        if (!usedColors.has(colorUpper)) {
          return color;
        }
      }
      
      // 如果所有预设颜色都用完了，生成一个与现有颜色不同的颜色
      // 使用HSL颜色空间生成均匀分布的颜色
      const hueStep = 360 / (usedColors.size + 1);
      for (let i = 0; i < 360; i += hueStep) {
        const hue = Math.floor(i) % 360;
        const saturation = 65 + (i % 3) * 10; // 65-85%
        const lightness = 45 + (i % 2) * 10; // 45-55%
        const color = this.hslToHex(hue, saturation, lightness);
        if (!usedColors.has(color.toUpperCase())) {
          return color;
        }
      }
      
      // 最后备选：随机颜色
      const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
      return randomColor.toUpperCase();
    }
    
    // HSL转HEX颜色
    private hslToHex(h: number, s: number, l: number): string {
      s /= 100;
      l /= 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
    }

    // 获取下一个可用的颜色（公共方法）
    getNextAvailableColor(): string {
      return this.generateUniqueColor();
    }

    // 项目管理
    addProject(name: string, color?: string, priority: 'high' | 'medium' | 'low' = 'medium', startDate: string | null = null, endDate: string | null = null, progress: string = '', completed: boolean = false) {
      // 如果没有指定颜色，自动生成一个不重复的颜色
      const projectColor = color || this.generateUniqueColor();
      const now = new Date().toISOString();
      const today = getLocalDateString();
      const project: Project = {
        id: Date.now(), // 使用整数ID，避免浮点数精度问题
        uniqueId: generateUniqueId(), // 生成唯一标识
        name,
        color: projectColor,
        priority,
        startDate: startDate || today, // 默认为创建日期
        endDate,
        progress,
        completed,
        updatedAt: now,
      };
      this.projects.push(project);
      this.saveToStorage();
    }

    updateProject(id: number, updates: Partial<Project>) {
      const project = this.projects.find(p => this.isIdEqual(p.id, id));
      if (project) {
        Object.assign(project, updates, { updatedAt: new Date().toISOString() });
        this.saveToStorage();
      }
    }

    deleteProject(id: number) {
      const project = this.projects.find(p => this.isIdEqual(p.id, id));
      const now = new Date().toISOString();
      
      // 记录已删除的项目名称（用于云端同步删除）
      if (project && project.name) {
        if (!this.deletedProjectNames.includes(project.name)) {
          this.deletedProjectNames.push(project.name);
        }
      }
      
      // 将属于该项目的待办事项移到回收站
      const projectTodos = this.todos.filter(t => t.projectId === id);
      projectTodos.forEach(todo => {
        this.deletedTodos.unshift({
          ...todo,
          projectId: null, // 清除项目关联
          updatedAt: now,
          deletedAt: now,
          deletedFromProject: project?.name || '',
          originalProjectId: id, // 保存原项目ID
          originalProjectColor: project?.color || '#3B82F6' // 保存原项目颜色
        });
      });
      
      // 从主列表中移除这些待办
      this.todos = this.todos.filter(t => !this.isIdEqual(t.projectId, id));
      // 删除项目
      this.projects = this.projects.filter(p => !this.isIdEqual(p.id, id));
      this.saveToStorage();
    }

    getProjects() {
      return this.projects;
    }

    getProjectById(id: number | null) {
      if (id === null) return null;
      return this.projects.find(p => this.isIdEqual(p.id, id));
    }

    hasProjects() {
      return this.projects.length > 0;
    }

    // 待办事项管理
    addTodo(text: string, projectId: number | null, plannedEndDate: string | null, priority: 'high' | 'medium' | 'low' = 'medium') {
      const now = new Date();
      const todo: Todo = {
        id: Date.now(), // 使用整数ID，避免浮点数精度问题
        uniqueId: generateUniqueId(), // 生成唯一标识
        text,
        completed: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        projectId,
        progress: '', // 默认为空，用户可自定义编辑
        priority,
        deadline: null,
        startDate: getLocalDateString(now), // 开始日期自动设为创建日期
        endDate: plannedEndDate, // 计划完成日期（可选）
      };
      this.todos.push(todo);
      
      // 如果项目已完结，自动取消完结状态
      if (projectId) {
        const project = this.projects.find(p => this.isIdEqual(p.id, projectId));
        if (project && project.completed) {
          project.completed = false;
        }
      }
      
      this.saveToStorage();
    }

    updateTodo(id: number, updates: Partial<Todo>) {
      const todo = this.todos.find(t => this.isIdEqual(t.id, id));
      if (todo) {
        Object.assign(todo, updates, { updatedAt: new Date().toISOString() });
        
        // 如果更新了项目归属，检查新项目是否已完结
        if (updates.projectId !== undefined && updates.projectId !== null) {
          const project = this.projects.find(p => this.isIdEqual(p.id, updates.projectId));
          if (project && project.completed) {
            project.completed = false;
          }
        }
        
        this.saveToStorage();
      }
    }

    toggleTodo(id: number) {
      const todo = this.todos.find(t => this.isIdEqual(t.id, id));
      if (todo) {
        todo.completed = !todo.completed;
        todo.updatedAt = new Date().toISOString();
        if (todo.completed) {
          todo.progress = 'completed';
          todo.completedAt = new Date().toISOString();
          // 完成后自动归档到工作总结
          this.completedTodos.unshift({
            ...todo
          });
          this.todos = this.todos.filter(t => !this.isIdEqual(t.id, id));
        }
        this.saveToStorage();
      }
    }

    deleteTodo(id: number) {
      const todo = this.todos.find(t => this.isIdEqual(t.id, id));
      if (todo) {
        const now = new Date().toISOString();
        // 获取项目信息用于恢复
        const project = todo.projectId ? this.projects.find(p => this.isIdEqual(p.id, todo.projectId)) : null;
        // 移动到回收站
        this.deletedTodos.unshift({
          ...todo,
          updatedAt: now,
          deletedAt: now,
          deletedFromProject: project?.name || '',
          originalProjectId: todo.projectId || undefined,
          originalProjectColor: project?.color || ''
        });
        // 使用isIdEqual过滤，确保正确删除
        this.todos = this.todos.filter(t => !this.isIdEqual(t.id, id));
        this.saveToStorage();
      }
    }

    // 获取已删除的待办（回收站）
    getDeletedTodos(): Todo[] {
      return this.deletedTodos;
    }

    // 获取已完成的待办（工作总结）
    getCompletedTodos(): Todo[] {
      return this.completedTodos;
    }

    // 从工作总结中删除
    deleteCompletedTodo(id: number) {
      this.completedTodos = this.completedTodos.filter(t => !this.isIdEqual(t.id, id));
      this.saveToStorage();
    }

    // 将已完成的任务退回主界面
    restoreCompletedTodo(id: number) {
      const todo = this.completedTodos.find(t => this.isIdEqual(t.id, id));
      if (todo) {
        // 重置完成状态
        todo.completed = false;
        todo.completedAt = undefined;
        // 添加回待办列表
        this.todos.push(todo);
        // 从工作总结中移除
        this.completedTodos = this.completedTodos.filter(t => !this.isIdEqual(t.id, id));
        this.saveToStorage();
      }
    }

    // 恢复待办
    restoreTodo(id: number) {
      const todo = this.deletedTodos.find(t => this.isIdEqual(t.id, id));
      if (todo) {
        const { deletedAt, deletedFromProject, originalProjectId, originalProjectColor, ...restoredTodo } = todo as any;
        const now = new Date().toISOString();
        
        // 如果有原项目信息，检查项目是否存在，不存在则创建
        if (originalProjectId && deletedFromProject) {
          const existingProject = this.projects.find(p => this.isIdEqual(p.id, originalProjectId));
          if (!existingProject) {
            // 创建同名项目
            const newProject: Project = {
              id: originalProjectId,
              uniqueId: generateUniqueId(),
              name: deletedFromProject,
              color: originalProjectColor || '#3B82F6',
              priority: 'medium' as const,
              startDate: null,
              endDate: null,
              progress: '',
              completed: false,
              updatedAt: now,
            };
            this.projects.push(newProject);
          }
          // 恢复项目关联
          restoredTodo.projectId = originalProjectId;
        }
        
        restoredTodo.updatedAt = now;
        this.todos.push(restoredTodo);
        this.deletedTodos = this.deletedTodos.filter(t => !this.isIdEqual(t.id, id));
        this.saveToStorage();
      }
    }

    // 永久删除
    permanentDeleteTodo(id: number) {
      this.deletedTodos = this.deletedTodos.filter(t => !this.isIdEqual(t.id, id));
      this.saveToStorage();
    }

    // 清空回收站
    clearTrash() {
      this.deletedTodos = [];
      this.saveToStorage();
    }

    // 设置已删除任务列表（用于同步后更新）
    setDeletedTodos(deletedTodos: Todo[]) {
      this.deletedTodos = deletedTodos;
      this.saveToStorage();
    }

    // 获取已删除的项目名称列表
    getDeletedProjectNames(): string[] {
      return [...this.deletedProjectNames];
    }

    // 清除已删除的项目名称列表（同步完成后调用）
    clearDeletedProjectNames() {
      this.deletedProjectNames = [];
      this.saveToStorage();
    }

    setFilter(filter: 'all' | 'completed' | 'pending') {
      this.filter = filter;
    }

    setProjectFilter(projectId: number | 'all' | 'uncategorized') {
      this.projectFilter = projectId;
    }

    setSortBy(sort: SortType) {
      this.sortBy = sort;
    }

    getTodos(): Todo[] {
      return [...this.todos];
    }

    getFilteredTodos(): Todo[] {
      let filtered = [...this.todos];

      // 按完成状态筛选
      if (this.filter === 'completed') {
        filtered = filtered.filter(t => t.completed);
      } else if (this.filter === 'pending') {
        filtered = filtered.filter(t => !t.completed);
      }

      // 按项目筛选
      if (this.projectFilter === 'uncategorized') {
        filtered = filtered.filter(t => t.projectId === null);
      } else if (this.projectFilter !== 'all') {
        filtered = filtered.filter(t => t.projectId === this.projectFilter);
      }

      // 排序
      if (this.sortBy === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      } else if (this.sortBy === 'created') {
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else if (this.sortBy === 'deadline') {
        // 没有截止日期的排在最后
        filtered.sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
      } else if (this.sortBy === 'project') {
        // 按项目分组排序：有项目的按项目名排序，未分类的排在最后
        filtered.sort((a, b) => {
          const projectA = a.projectId ? this.projects.find(p => this.isIdEqual(p.id, a.projectId))?.name : '';
          const projectB = b.projectId ? this.projects.find(p => this.isIdEqual(p.id, b.projectId))?.name : '';
          const nameA = projectA || 'zzz'; // 未分类排在最后
          const nameB = projectB || 'zzz';
          return nameA.localeCompare(nameB, 'zh-CN');
        });
      }

      return filtered;
    }

    // 获取按项目分组的待办
    getGroupedTodos(): Map<number | null, Todo[]> {
      const filtered = this.getFilteredTodos();
      const groups = new Map<number | null, Todo[]>();
      
      filtered.forEach(todo => {
        const key = todo.projectId;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(todo);
      });
      
      return groups;
    }

    // 切换项目折叠状态
    toggleGroupCollapse(projectId: number | null) {
      const key = String(projectId);
      if (this.collapsedGroups.has(key)) {
        this.collapsedGroups.delete(key);
      } else {
        this.collapsedGroups.add(key);
      }
      this.saveToStorage();
    }

    // 检查项目是否折叠
    isGroupCollapsed(projectId: number | null): boolean {
      return this.collapsedGroups.has(String(projectId));
    }

    getStats() {
      const total = this.todos.length;
      const completed = this.todos.filter(t => t.completed).length;
      const pending = total - completed;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { total, completed, pending, percentage };
    }

    getProjectStats() {
      return this.projects.map(project => {
        const projectTodos = this.todos.filter(t => t.projectId === project.id);
        const total = projectTodos.length;
        const completed = projectTodos.filter(t => t.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          id: project.id,
          name: project.name,
          color: project.color,
          total,
          completed,
          percentage,
        };
      }).filter(p => p.total > 0);
    }

    setTheme(theme: keyof typeof themes) {
      this.currentTheme = theme;
      this.saveToStorage();
    }

    getTheme() {
      return this.currentTheme;
    }

    isAuthenticated() {
      return this.isLoggedIn;
    }

    getFilter() {
      return this.filter;
    }

    getProjectFilter() {
      return this.projectFilter;
    }

    getSortBy() {
      return this.sortBy;
    }
    
    // 批量选择模式相关方法
    toggleBatchMode(projectId: number | null) {
      if (this.batchModeProjectId === projectId) {
        // 再次点击同一项目的批量管理，退出批量模式
        this.batchModeProjectId = 'none';
        this.selectedTodoIds.clear();
      } else {
        // 切换到该项目的批量模式
        this.batchModeProjectId = projectId;
        this.selectedTodoIds.clear();
      }
    }
    
    isBatchMode(projectId?: number | null) {
      if (projectId === undefined) {
        return this.batchModeProjectId !== 'none';
      }
      return this.batchModeProjectId === projectId;
    }
    
    getBatchModeProjectId() {
      return this.batchModeProjectId;
    }
    
    toggleTodoSelection(id: number) {
      if (this.selectedTodoIds.has(id)) {
        this.selectedTodoIds.delete(id);
      } else {
        this.selectedTodoIds.add(id);
      }
    }
    
    isTodoSelected(id: number) {
      return this.selectedTodoIds.has(id);
    }
    
    selectAllTodosInProject(projectId: number | null) {
      const todos = projectId === null 
        ? this.todos.filter(t => t.projectId === null)
        : this.todos.filter(t => t.projectId === projectId);
      todos.forEach(t => this.selectedTodoIds.add(t.id));
    }
    
    deselectAllTodos() {
      this.selectedTodoIds.clear();
    }
    
    getSelectedTodoIds() {
      return [...this.selectedTodoIds];
    }
    
    getSelectedCount() {
      return this.selectedTodoIds.size;
    }
    
    deleteSelectedTodos() {
      const now = new Date().toISOString();
      this.selectedTodoIds.forEach(id => {
        const todo = this.todos.find(t => this.isIdEqual(t.id, id));
        if (todo) {
          const project = todo.projectId ? this.projects.find(p => this.isIdEqual(p.id, todo.projectId)) : null;
          this.deletedTodos.unshift({
            ...todo,
            updatedAt: now,
            deletedAt: now,
            deletedFromProject: project?.name || '',
            originalProjectId: todo.projectId || undefined,
            originalProjectColor: project?.color || ''
          });
        }
      });
      this.todos = this.todos.filter(t => !this.selectedTodoIds.has(t.id));
      this.selectedTodoIds.clear();
      this.batchModeProjectId = 'none';
      this.saveToStorage();
    }
  }

  // 创建应用实例
  const todoApp = new TodoApp();
  
  // 设置自动同步回调 - 每次保存数据后自动同步到云端
  todoApp.setOnSaveCallback(() => {
    debouncedSyncToCloud();
  });

  // 格式化日期
  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  function formatDateShort(isoString: string): string {
    const date = new Date(isoString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  }

  // 渲染登录页面
  function renderLogin() {
    const theme = themes[todoApp.getTheme()];
    return `
      <div class="login-container" style="background: ${theme.gradient};">
        <div class="login-card">
          <div class="login-header">
            <div class="login-app-icon">
              <div class="app-icon-inner">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>
              </div>
            </div>
            <h2>项目管理器</h2>
            <p>高效管理您的任务与项目</p>
          </div>
          <div class="cloud-login-main">
            <button id="cloud-login-btn" class="cloud-login-btn-main">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
              账号登录 / 注册
            </button>
            <p class="cloud-feature">
              <span class="feature-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>云端存储</span>
              <span class="feature-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>多端同步</span>
              <span class="feature-item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>数据安全</span>
            </p>
          </div>
          <div class="login-divider">
            <span>或</span>
          </div>
          <div class="local-login-section">
            <div class="local-login-header">
              <span class="local-label">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                本地模式
              </span>
              <span class="local-desc">数据仅存储在本机</span>
            </div>
            <div class="local-login-form">
              <input type="password" id="password-input" placeholder="输入本地密码" class="login-input local-input" />
              <button id="login-btn" class="login-button local-btn">进入</button>
            </div>
            <p class="login-hint local-hint">默认密码：123456</p>
          </div>
        </div>
      </div>
    `;
  }
  
  // 渲染云端登录页面
  function renderCloudLogin(mode: 'login' | 'register' = 'login', error: string = '') {
    const theme = themes[todoApp.getTheme()];
    const iconSvg = mode === 'login' 
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>';
    return `
      <div class="login-container" style="background: ${theme.gradient};">
        <div class="login-card cloud-login-card">
          <div class="login-header">
            <div class="login-app-icon">
              <div class="app-icon-inner">
                ${iconSvg}
              </div>
            </div>
            <h2>${mode === 'login' ? '账号登录' : '注册账号'}</h2>
            <p>${mode === 'login' ? '登录后可跨设备同步数据' : '注册新账号，数据云端存储'}</p>
          </div>
          <div class="login-form">
            <div class="input-with-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <input type="email" id="cloud-email-input" placeholder="请输入邮箱" class="login-input with-icon" />
            </div>
            <div class="input-with-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input type="password" id="cloud-password-input" placeholder="请输入密码" class="login-input with-icon" />
            </div>
            ${mode === 'register' ? '<div class="input-with-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><input type="password" id="cloud-password-confirm" placeholder="请确认密码" class="login-input with-icon" /></div>' : ''}
            ${error ? `<p class="login-error">${error}</p>` : ''}
            <button id="cloud-submit-btn" class="login-button">
              ${mode === 'login' ? '登 录' : '注 册'}
            </button>
          </div>
          <div class="login-switch">
            ${mode === 'login' 
              ? '没有账号？<a href="#" id="switch-to-register">立即注册</a>' 
              : '已有账号？<a href="#" id="switch-to-login">返回登录</a>'}
          </div>
          <button id="back-to-local-btn" class="back-to-local-btn">
            ← 返回本地模式
          </button>
        </div>
      </div>
    `;
  }

  // 渲染分组待办列表
  function renderGroupedTodos(theme: typeof themes.minimal): string {
    const groupedTodos = todoApp.getGroupedTodos();
    const projects = todoApp.getProjects();
    const progressConfigAll = getProgressConfig(todoApp.getCustomProgressStates());
    let html = '';
    
    // 构建所有要显示的项目ID列表（包含所有未完结的项目）
    const allProjectIds: (number | null)[] = projects.filter(p => !p.completed).map(p => p.id);
    
    // 如果有未分类任务，添加未分类分组
    if (groupedTodos.has(null)) {
      allProjectIds.push(null);
    }
    
    // 按项目名称排序
    allProjectIds.sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      const projectA = projects.find(p => isIdEqual(p.id, a));
      const projectB = projects.find(p => isIdEqual(p.id, b));
      return (projectA?.name || '').localeCompare(projectB?.name || '', 'zh-CN');
    });
    
    // 如果没有任何项目，显示空状态提示
    if (allProjectIds.length === 0) {
      return `
        <div class="empty-projects-state">
          <div class="empty-projects-icon">${getIcon('folder')}</div>
          <p class="empty-projects-text">暂无项目</p>
          <p class="empty-projects-hint">点击上方"项目管理"创建新项目</p>
        </div>
      `;
    }
    
    for (const projectId of allProjectIds) {
      const todos = groupedTodos.get(projectId) || [];
      const project = projectId ? projects.find(p => isIdEqual(p.id, projectId)) : null;
      const groupName = project?.name || '未分类';
      const groupColor = project?.color || '#6B7280';
      const projectPriority = project?.priority || 'medium';
      const projectPriorityConf = projectPriorityConfig[projectPriority];
      const isCollapsed = todoApp.isGroupCollapsed(projectId);
      const completedCount = todos.filter(t => t.completed).length;
      const projectStartDate = project?.startDate || null;
      const projectEndDate = project?.endDate || null;
      const projectProgress = project?.progress || null;
      const isBatchModeForThisProject = todoApp.isBatchMode(projectId);
      
      html += `
        <div class="todo-group">
          <div class="group-header" data-project-id="${projectId}" style="border-left-color: ${groupColor};">
            <div class="group-header-left">
              <span class="group-collapse-icon ${isCollapsed ? '' : 'expanded'}">${getIcon('chevron')}</span>
              <span class="group-name" style="color: ${groupColor};">${groupName}</span>
              <span class="project-priority-indicator" style="background: ${projectPriorityConf.bg}; color: ${projectPriorityConf.color};">${projectPriorityConf.label}</span>
              ${projectId ? `
              <span class="project-info-divider">|</span>
              <span class="project-info-item"><span class="info-label">开始</span><span class="info-value">${projectStartDate || '-'}</span></span>
              <span class="project-info-item"><span class="info-label">计划</span><span class="info-value">${projectEndDate || '-'}</span></span>
              <span class="project-info-item"><span class="info-label">进度</span><span class="info-value ${projectProgress ? 'has-progress' : ''}">${projectProgress || '-'}</span></span>
              ` : ''}
              <span class="group-count">${completedCount}/${todos.length}</span>
            </div>
            <div class="group-header-actions">
              ${isBatchModeForThisProject ? '' : `
                ${projectId ? `<button class="group-edit-project-btn" data-project-id="${projectId}" title="编辑项目">${getIcon('edit')}</button>` : ''}
                <button class="group-add-btn" data-project-id="${projectId}" title="添加任务">${getIcon('plus')}</button>
              `}
              <button class="group-batch-btn ${isBatchModeForThisProject ? 'active' : ''}" data-project-id="${projectId}" title="${isBatchModeForThisProject ? '取消批量管理' : '批量管理'}">
                ${isBatchModeForThisProject ? '取消' : '批量'}
              </button>
            </div>
          </div>
          ${isBatchModeForThisProject ? `
          <div class="batch-action-bar">
            <button class="batch-action-btn select-all-in-group-btn" data-project-id="${projectId}">全选</button>
            <button class="batch-action-btn deselect-all-btn">取消全选</button>
            <span class="batch-count">已选 ${todoApp.getSelectedCount()} 项</span>
            <button class="batch-delete-btn" ${todoApp.getSelectedCount() === 0 ? 'disabled' : ''}>删除选中</button>
          </div>
          ` : ''}
          <div class="group-todos ${isCollapsed ? 'collapsed' : ''}">
            ${todos.length === 0 ? `
              <div class="empty-group-hint">
                <span>暂无任务，点击 + 添加</span>
              </div>
            ` : todos.map(todo => {
              const priorityConf = priorityConfig[todo.priority];
              const progressConf = progressConfigAll[todo.progress] || { label: todo.progress, color: '#718096', bg: '#E2E8F0' };
              const createdDate = todo.createdAt ? todo.createdAt.split('T')[0] : '';
              const isSelected = isBatchModeForThisProject && todoApp.isTodoSelected(todo.id);
              return `
                <div class="todo-item ${todo.completed ? 'completed' : ''} ${isSelected ? 'selected' : ''}" style="border-left-color: ${groupColor};">
                  <div class="todo-main">
                    ${isBatchModeForThisProject ? `
                      <input type="checkbox" class="batch-checkbox" ${isSelected ? 'checked' : ''} data-id="${todo.id}" />
                    ` : `
                      <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} data-id="${todo.id}" />
                    `}
                    <span class="todo-text-inline">${todo.text}</span>
                    <div class="todo-badges-inline">
                      <span class="task-priority-badge" style="background: ${priorityConf.bg}; color: ${priorityConf.color};">${priorityConf.label}</span>
                      ${todo.progress ? `<span class="progress-badge" style="background: ${progressConf.bg}; color: ${progressConf.color};">${progressConf.label}</span>` : ''}
                      ${createdDate ? `<span class="date-badge created" title="创建日期">${getIcon('calendar')}${createdDate}</span>` : ''}
                      ${todo.endDate ? `<span class="date-badge planned" title="计划完成日期">→ ${todo.endDate}</span>` : ''}
                    </div>
                    ${!isBatchModeForThisProject ? `
                    <div class="todo-actions">
                      <button class="edit-btn" data-id="${todo.id}" title="编辑">${getIcon('edit')}</button>
                      <button class="delete-btn" data-id="${todo.id}" data-todo-unique-id="${todo.uniqueId || ''}" data-todo-text="${todo.text.replace(/"/g, '&quot;')}" title="删除">${getIcon('trash')}</button>
                    </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    return html;
  }

  // 渲染主应用页面
  function renderMain() {
    const theme = themes[todoApp.getTheme()];
    const stats = todoApp.getStats();
    const projectStats = todoApp.getProjectStats();
    const filteredTodos = todoApp.getFilteredTodos();
    const projects = todoApp.getProjects();

    console.log('renderMain: 当前项目列表:', projects.map(p => ({ id: p.id, name: p.name })));
    console.log('renderMain: 是否云端模式:', todoApp.isCloudMode());
    console.log('renderMain: 云端用户ID:', todoApp.getCloudUserId());

    return `
      <div class="app-container ${todoApp.getTheme() === 'cute' ? 'cute-style' : todoApp.getTheme() === 'business' ? 'business-style' : ''}" style="background: ${theme.gradient};">
        <div class="app-content">
          <header class="app-header">
            <div class="header-top">
              <h1>项目管理器</h1>
              <div class="header-actions">
                <button id="project-manage-btn" class="project-manage-btn">${getIcon('folder')}<span>项目管理</span></button>
                <button id="project-overview-btn" class="project-manage-btn">${getIcon('chart')}<span>项目一览</span></button>
                <button id="summary-btn" class="project-manage-btn">${getIcon('clipboard')}<span>工作总结</span></button>
                <button id="trash-btn" class="icon-btn trash-btn" title="回收站">${getIcon('trash2')}${todoApp.getDeletedTodos().length > 0 ? `<span class="trash-count">${todoApp.getDeletedTodos().length}</span>` : ''}</button>
                <button id="settings-btn" class="icon-btn" title="设置">${getIcon('settings')}</button>
                ${todoApp.isCloudMode() ? `<button id="sync-btn" class="icon-btn sync-btn" title="同步数据">${getIcon('refresh')}</button>` : ''}
                <button id="logout-btn" class="icon-btn" title="退出登录">${getIcon('logout')}</button>
              </div>
            </div>

            <div class="stats-panel">
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-icon" style="background: ${theme.primaryLight}; color: ${theme.primary};">${getIcon('list')}</div>
                  <div class="stat-info">
                    <span class="stat-label">总任务</span>
                    <span class="stat-value">${stats.total}</span>
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-icon" style="background: #C6F6D5; color: #38A169;">${getIcon('check')}</div>
                  <div class="stat-info">
                    <span class="stat-label">已完成</span>
                    <span class="stat-value">${stats.completed}</span>
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-icon" style="background: #FEFCBF; color: #D69E2E;">${getIcon('clock')}</div>
                  <div class="stat-info">
                    <span class="stat-label">待完成</span>
                    <span class="stat-value">${stats.pending}</span>
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-icon" style="background: ${theme.primaryLight}; color: ${theme.primary};">${getIcon('percent')}</div>
                  <div class="stat-info">
                    <span class="stat-label">完成率</span>
                    <span class="stat-percentage">${stats.percentage}%</span>
                  </div>
                </div>
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-label">
                  <span>总体进度</span>
                  <span>${stats.percentage}%</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width: ${stats.percentage}%;"></div>
                </div>
              </div>
              
              ${projectStats.length > 0 ? `
                <div class="project-stats" style="margin-top: 20px;">
                  <h4 style="font-size: 13px; font-weight: 600; color: ${theme.textColorLight}; margin-bottom: 12px;">按项目统计</h4>
                  <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px;">
                    ${projectStats.map(ps => `
                      <div style="padding: 12px; background: #FAFBFC; border-radius: 10px; border-left: 3px solid ${ps.color};">
                        <div style="font-size: 12px; font-weight: 500; color: ${theme.textColor}; margin-bottom: 4px;">${ps.name}</div>
                        <div style="font-size: 18px; font-weight: 700; color: ${theme.textColor};">${ps.completed}/${ps.total}</div>
                        <div style="font-size: 11px; color: ${theme.textColorLight};">${ps.percentage}% 完成</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </header>

          <main class="main-content">
            <div class="add-todo-section">
              <div class="add-todo-row single-row">
                <input type="text" id="todo-input" placeholder="添加新任务..." class="todo-input" />
                <select id="project-select" class="todo-select compact">
                  <option value="uncategorized">未分类</option>
                  ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
                <select id="priority-select" class="todo-select compact" title="任务优先级">
                  <option value="high">🔴 高</option>
                  <option value="medium" selected>🟡 中</option>
                  <option value="low">🟢 低</option>
                </select>
                <input type="date" id="planned-end-date-input" class="todo-date compact" title="计划完成日期（可选）" />
                <button id="add-todo-btn" class="add-btn">添加</button>
              </div>
            </div>

            <div class="filter-section">
              <select id="project-filter" class="filter-select">
                <option value="all" ${todoApp.getProjectFilter() === 'all' ? 'selected' : ''}>全部项目</option>
                <option value="uncategorized" ${todoApp.getProjectFilter() === 'uncategorized' ? 'selected' : ''}>未分类</option>
                ${projects.map(p => `<option value="${p.id}" ${todoApp.getProjectFilter() === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
              <select id="sort-select" class="filter-select">
                <option value="project" ${todoApp.getSortBy() === 'project' ? 'selected' : ''}>按项目分组</option>
                <option value="created" ${todoApp.getSortBy() === 'created' ? 'selected' : ''}>创建日期排序</option>
                <option value="priority" ${todoApp.getSortBy() === 'priority' ? 'selected' : ''}>优先级排序</option>
                <option value="deadline" ${todoApp.getSortBy() === 'deadline' ? 'selected' : ''}>截止日期排序</option>
              </select>
            </div>

            <div class="todos-list">
              ${todoApp.getSortBy() === 'project' ? renderGroupedTodos(theme) : filteredTodos.length === 0 ? `
                <div class="empty-state">
                  ${getIcon('inbox')}
                  <p>暂无任务</p>
                </div>
              ` : filteredTodos.map(todo => {
                const project = todoApp.getProjectById(todo.projectId);
                const projectColor = project?.color || '#6B7280';
                const priorityConf = priorityConfig[todo.priority];
                const progressConfigAll = getProgressConfig(todoApp.getCustomProgressStates());
                const progressConf = progressConfigAll[todo.progress] || { label: todo.progress, color: '#718096', bg: '#E2E8F0' };
                const createdDate = todo.createdAt ? todo.createdAt.split('T')[0] : '';
                const isSelected = todoApp.isBatchMode() && todoApp.isTodoSelected(todo.id);
                return `
                <div class="todo-item ${todo.completed ? 'completed' : ''} ${isSelected ? 'selected' : ''}" style="border-left-color: ${projectColor};">
                  <div class="todo-main">
                    ${todoApp.isBatchMode() ? `
                      <input type="checkbox" class="batch-checkbox" ${isSelected ? 'checked' : ''} data-id="${todo.id}" />
                    ` : `
                      <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} data-id="${todo.id}" />
                    `}
                    <span class="todo-text-inline">${todo.text}</span>
                    <div class="todo-badges-inline">
                      <span class="task-priority-badge" style="background: ${priorityConf.bg}; color: ${priorityConf.color};">${priorityConf.label}</span>
                      ${todo.progress ? `<span class="progress-badge" style="background: ${progressConf.bg}; color: ${progressConf.color};">${progressConf.label}</span>` : ''}
                      ${createdDate ? `<span class="date-badge created" title="创建日期">${getIcon('calendar')}${createdDate}</span>` : ''}
                      ${todo.endDate ? `<span class="date-badge planned" title="计划完成日期">→ ${todo.endDate}</span>` : ''}
                    </div>
                    ${!todoApp.isBatchMode() ? `
                    <div class="todo-actions">
                      <button class="edit-btn" data-id="${todo.id}" title="编辑">${getIcon('edit')}</button>
                      <button class="delete-btn" data-id="${todo.id}" data-todo-unique-id="${todo.uniqueId || ''}" data-todo-text="${todo.text.replace(/"/g, '&quot;')}" title="删除">${getIcon('trash')}</button>
                    </div>
                    ` : ''}
                  </div>
                </div>
              `}).join('')}
            </div>
          </main>
        </div>
        
        <!-- 悬浮任务窗口 -->
        <div class="floating-task-widget minimized" id="floating-widget">
          <div class="floating-widget-header" id="floating-header">
            <div class="floating-widget-title">
              ${getIcon('zap')}
              <span>快速添加</span>
            </div>
            <div class="floating-widget-actions">
              <button class="floating-toggle-btn" id="floating-toggle-list" title="展开任务列表">
                ${getIcon('list')}
              </button>
              <button class="floating-minimize-btn" id="floating-minimize" title="最小化">
                ${getIcon('minimize')}
              </button>
            </div>
          </div>
          <div class="floating-widget-body" id="floating-body">
            <div class="floating-add-section">
              <input type="text" id="floating-todo-input" placeholder="输入任务内容..." class="floating-input" />
              <div class="floating-options">
                <select id="floating-project-select" class="floating-select">
                  <option value="uncategorized">未分类</option>
                  ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
                <select id="floating-priority-select" class="floating-select small">
                  <option value="high">🔴</option>
                  <option value="medium" selected>🟡</option>
                  <option value="low">🟢</option>
                </select>
                <input type="date" id="floating-date-input" class="floating-date" title="计划完成日期" />
                <button id="floating-add-btn" class="floating-add-btn" title="添加任务">
                  ${getIcon('plus')}
                </button>
              </div>
            </div>
            <div class="floating-task-list" id="floating-task-list">
              <div class="floating-list-header">
                <span>最近任务</span>
                <button class="floating-collapse-btn" id="floating-collapse-list" title="收起">
                  ${getIcon('chevronUp')}
                </button>
              </div>
              <div class="floating-list-content" id="floating-list-content">
                ${renderFloatingTaskList()}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 悬浮触发按钮 -->
        <div class="floating-trigger" id="floating-trigger" title="打开快速添加">
          ${getIcon('plus')}
        </div>
      </div>
    `;
  }
  
  // 渲染悬浮窗口任务列表
  function renderFloatingTaskList(): string {
    const allTodos = todoApp.getTodos();
    const recentTodos = allTodos.slice(0, 10); // 最近10条
    const projects = todoApp.getProjects();
    const progressConfigAll = getProgressConfig(todoApp.getCustomProgressStates());
    
    if (recentTodos.length === 0) {
      return '<div class="floating-empty">暂无任务</div>';
    }
    
    return recentTodos.map(todo => {
      const project = projects.find(p => isIdEqual(p.id, todo.projectId));
      const projectColor = project?.color || '#6B7280';
      const priorityConf = priorityConfig[todo.priority];
      
      return `
        <div class="floating-task-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
          <input type="checkbox" class="floating-task-checkbox" ${todo.completed ? 'checked' : ''} data-id="${todo.id}" />
          <span class="floating-task-text">${todo.text}</span>
          <span class="floating-task-project" style="background: ${projectColor}20; color: ${projectColor};">
            ${project?.name || '未分类'}
          </span>
        </div>
      `;
    }).join('');
  }

  // 计算两个日期之间的天数
  function calculateDaysBetween(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // 包含首尾两天
  }

  // 渲染项目一览页面（独立页面）
  function renderProjectOverviewPage(): string {
    const theme = themes[todoApp.getTheme()];
    const allTodos = todoApp.getTodos();
    const completedTodos = todoApp.getCompletedTodos();
    const projects = todoApp.getProjects();
    const progressConfigAll = getProgressConfig(todoApp.getCustomProgressStates());
    
    // 构建项目统计（包含所有项目，包括已完结的）
    const projectStats: Map<number | null, { pending: Todo[]; completed: Todo[] }> = new Map();
    
    // 初始化所有项目
    projects.forEach(p => {
      projectStats.set(p.id, { pending: [], completed: [] });
    });
    projectStats.set(null, { pending: [], completed: [] });
    
    // 统计所有任务（根据 progress 状态或 completed 字段判断是否完成）
    allTodos.forEach((todo: Todo) => {
      const projectId = todo.projectId;
      if (projectStats.has(projectId)) {
        if (isTodoCompleted(todo)) {
          projectStats.get(projectId)!.completed.push(todo);
        } else {
          projectStats.get(projectId)!.pending.push(todo);
        }
      }
    });
    
    // 统计已完成任务
    completedTodos.forEach((todo: Todo) => {
      const projectId = todo.projectId;
      if (projectStats.has(projectId)) {
        projectStats.get(projectId)!.completed.push(todo);
      }
    });
    
    // 按项目名称排序
    const sortedProjectIds = Array.from(projectStats.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      const projectA = projects.find(p => isIdEqual(p.id, a));
      const projectB = projects.find(p => isIdEqual(p.id, b));
      return (projectA?.name || '').localeCompare(projectB?.name || '', 'zh-CN');
    });
    
    // 计算总耗时
    let totalDays = 0;
    completedTodos.forEach((todo: Todo) => {
      if (todo.createdAt && todo.completedAt) {
        totalDays += calculateDaysBetween(
          todo.createdAt.split('T')[0],
          todo.completedAt.split('T')[0]
        );
      }
    });
    
    const totalPending = allTodos.filter((t: Todo) => !t.completed).length;
    const totalCompleted = completedTodos.length + allTodos.filter((t: Todo) => t.completed).length;
    
    return `
      <div class="app-container ${todoApp.getTheme()}" style="min-height: 100vh; background: ${theme.background};">
        <header class="app-header" style="background: ${theme.cardBg};">
          <div class="header-left">
            <button id="back-to-main-btn" class="back-btn" title="返回">
              ${getIcon('arrowLeft')}
            </button>
            <h1 class="header-title">项目一览</h1>
          </div>
          <div class="header-right">
            <span class="summary-stats">共 ${totalPending + totalCompleted} 项任务，已完成 ${totalCompleted} 项，总耗时 ${totalDays} 天</span>
            <button id="export-overview-btn" class="export-btn" title="导出Excel">${getIcon('download')}导出</button>
          </div>
        </header>
        
        <main class="summary-page-content">
          ${sortedProjectIds.length === 0 || (sortedProjectIds.length === 1 && sortedProjectIds[0] === null && projectStats.get(null)?.pending.length === 0 && projectStats.get(null)?.completed.length === 0) ? `
            <div class="empty-state">
              ${getIcon('folder')}
              <p>暂无项目数据</p>
              <p class="empty-hint">创建项目并添加任务后可在此查看统计</p>
            </div>
          ` : `
            <div class="summary-list">
              ${sortedProjectIds.map(projectId => {
                const stats = projectStats.get(projectId)!;
                if (stats.pending.length === 0 && stats.completed.length === 0) return '';
                
                const project = projectId ? projects.find(p => isIdEqual(p.id, projectId)) : null;
                const projectName = project?.name || '未分类';
                const projectColor = project?.color || '#6B7280';
                const projectPriority = project?.priority || 'medium';
                const projectPriorityConf = projectPriorityConfig[projectPriority];
                const projectCompleted = project?.completed || false;
                
                // 计算项目耗时
                let projectDays = 0;
                stats.completed.forEach(todo => {
                  if (todo.createdAt && todo.completedAt) {
                    projectDays += calculateDaysBetween(
                      todo.createdAt.split('T')[0],
                      todo.completedAt.split('T')[0]
                    );
                  }
                });
                
                return `
                  <div class="summary-project-card ${projectCompleted ? 'project-completed' : ''}" style="background: ${theme.cardBg};">
                    <div class="summary-project-header" style="border-left-color: ${projectColor};">
                      <div class="summary-project-title-row">
                        <span class="summary-project-name" style="color: ${projectColor};">${projectName}</span>
                        <span class="project-priority-indicator" style="background: ${projectPriorityConf.bg}; color: ${projectPriorityConf.color};">${projectPriorityConf.label}</span>
                        ${projectCompleted ? '<span class="project-completed-badge">已完结</span>' : ''}
                        ${project ? `<button class="project-delete-btn" data-project-id="${project.id}" data-project-name="${project.name}" title="删除项目">${getIcon('trash')}</button>` : ''}
                      </div>
                      <div class="summary-project-stats">
                        <span class="project-stat pending">待完成 ${stats.pending.length}</span>
                        <span class="project-stat completed">已完成 ${stats.completed.length}</span>
                        <span class="project-stat days">耗时 ${projectDays} 天</span>
                      </div>
                    </div>
                    <div class="summary-project-content">
                      ${stats.pending.length > 0 ? `
                        <div class="overview-section">
                          <div class="overview-section-header">
                            ${getIcon('clock')}
                            <span>待完成 (${stats.pending.length})</span>
                          </div>
                          <div class="summary-todos-list">
                            ${stats.pending.map(todo => {
                              const priorityConf = priorityConfig[todo.priority];
                              const progressConf = progressConfigAll[todo.progress] || { label: todo.progress || '未开始', color: '#718096', bg: '#E2E8F0' };
                              const createdDate = todo.createdAt ? todo.createdAt.split('T')[0] : '未知';
                              return `
                                <div class="overview-todo-item pending-item" style="background: ${theme.primaryLight};">
                                  <div class="overview-todo-title">${todo.text}</div>
                                  <div class="overview-todo-info">
                                    <div class="overview-todo-meta">
                                      <span class="priority-tag" style="background: ${priorityConf.bg}; color: ${priorityConf.color};">${priorityConf.label}</span>
                                      <span class="progress-tag" style="background: ${progressConf.bg}; color: ${progressConf.color};">${progressConf.label}</span>
                                      <span class="date-tag">创建: ${createdDate}</span>
                                    </div>
                                    <button class="overview-todo-delete-btn" data-todo-id="${todo.id}" data-todo-unique-id="${todo.uniqueId || ''}" data-todo-text="${todo.text.replace(/"/g, '&quot;')}" data-is-completed="false" title="删除任务">${getIcon('trash')}</button>
                                  </div>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        </div>
                      ` : ''}
                      ${stats.completed.length > 0 ? `
                        <div class="overview-section">
                          <div class="overview-section-header">
                            ${getIcon('check')}
                            <span>已完成 (${stats.completed.length})</span>
                          </div>
                          <div class="summary-todos-list">
                            ${stats.completed.map(todo => {
                              const createdDate = todo.createdAt ? todo.createdAt.split('T')[0] : '未知';
                              const completedDate = todo.completedAt ? todo.completedAt.split('T')[0] : '未知';
                              const days = todo.createdAt && todo.completedAt 
                                ? calculateDaysBetween(createdDate, completedDate)
                                : 0;
                              return `
                                <div class="overview-todo-item completed-item" style="background: #E8F5E9;">
                                  <div class="overview-todo-title">${todo.text}</div>
                                  <div class="overview-todo-info">
                                    <div class="overview-todo-dates">
                                      <span class="date-tag start">创建: ${createdDate}</span>
                                      <span class="date-arrow">→</span>
                                      <span class="date-tag end">完成: ${completedDate}</span>
                                    </div>
                                    <div class="overview-todo-actions">
                                      <span class="summary-days-badge">耗时 ${days} 天</span>
                                      <button class="overview-todo-delete-btn" data-todo-id="${todo.id || ''}" data-todo-unique-id="${todo.uniqueId || ''}" data-todo-text="${todo.text.replace(/"/g, '&quot;')}" data-is-completed="true" title="删除任务">${getIcon('trash')}</button>
                                    </div>
                                  </div>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </main>
      </div>
    `;
  }

  // 渲染项目一览页面视图
  function renderProjectOverviewPageView() {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = renderProjectOverviewPage();
      attachProjectOverviewPageListeners();
    }
  }

  // 项目一览页面事件监听
  function attachProjectOverviewPageListeners() {
    const backBtn = document.getElementById('back-to-main-btn');
    
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        render(); // 返回主页面
      });
    }
    
    // 导出按钮
    const exportBtn = document.getElementById('export-overview-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportProjectOverviewToExcel();
      });
    }
    
    // 项目删除按钮
    document.querySelectorAll('.project-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const projectId = parseInt((e.currentTarget as HTMLElement).dataset.projectId || '0');
        const projectName = (e.currentTarget as HTMLElement).dataset.projectName || '';
        
        if (confirm(`确定要删除项目"${projectName}"吗？\n\n该项目的所有任务将移入回收站。`)) {
          await deleteProjectWithSync(projectId, todoApp.getProjectById(projectId));
          renderProjectOverviewPageView();
        }
      });
    });
    
    // 任务删除按钮
    document.querySelectorAll('.overview-todo-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const todoIdStr = (e.currentTarget as HTMLElement).dataset.todoId || '';
        const todoId = todoIdStr ? parseInt(todoIdStr) : null;
        const uniqueId = (e.currentTarget as HTMLElement).dataset.todoUniqueId || '';
        const todoText = (e.currentTarget as HTMLElement).dataset.todoText || '';
        const isCompleted = (e.currentTarget as HTMLElement).dataset.isCompleted === 'true';
        
        const confirmMsg = isCompleted 
          ? `确定要删除已完成任务"${todoText}"吗？\n\n该操作不可恢复。`
          : `确定要删除任务"${todoText}"吗？\n\n任务将移入回收站。`;
        
        if (confirm(confirmMsg)) {
          await deleteTodoWithSync(todoId, uniqueId, isCompleted, todoText);
          renderProjectOverviewPageView();
        }
      });
    });
  }

  // 导出项目一览到Excel
  function exportProjectOverviewToExcel() {
    const allTodos = todoApp.getTodos();
    const completedTodos = todoApp.getCompletedTodos();
    const projects = todoApp.getProjects();
    
    // 按项目分组
    const projectStats: Map<number | null, { pending: Todo[]; completed: Todo[] }> = new Map();
    
    projects.forEach(p => {
      projectStats.set(p.id, { pending: [], completed: [] });
    });
    projectStats.set(null, { pending: [], completed: [] });
    
    allTodos.forEach((todo: Todo) => {
      const projectId = todo.projectId;
      if (projectStats.has(projectId)) {
        if (todo.completed) {
          projectStats.get(projectId)!.completed.push(todo);
        } else {
          projectStats.get(projectId)!.pending.push(todo);
        }
      }
    });
    
    completedTodos.forEach((todo: Todo) => {
      const projectId = todo.projectId;
      if (projectStats.has(projectId)) {
        projectStats.get(projectId)!.completed.push(todo);
      }
    });
    
    // 构建CSV内容
    let csvContent = '\uFEFF';
    csvContent += '项目名称,项目状态,任务内容,任务状态,优先级,进度,创建日期,完成日期,耗时天数\n';
    
    projectStats.forEach((stats, projectId) => {
      const project = projectId ? projects.find(p => isIdEqual(p.id, projectId)) : null;
      const projectName = project?.name || '未分类';
      const projectStatus = project?.completed ? '已完结' : '进行中';
      
      // 未完成任务
      stats.pending.forEach(todo => {
        const createdDate = todo.createdAt ? todo.createdAt.split('T')[0] : '未知';
        csvContent += `${projectName},${projectStatus},"${todo.text}",待完成,${todo.priority},${todo.progress || '未开始'},${createdDate},,\n`;
      });
      
      // 已完成任务
      stats.completed.forEach(todo => {
        const createdDate = todo.createdAt ? todo.createdAt.split('T')[0] : '未知';
        const completedDate = todo.completedAt ? todo.completedAt.split('T')[0] : '未知';
        const days = todo.createdAt && todo.completedAt 
          ? calculateDaysBetween(createdDate, completedDate)
          : 0;
        csvContent += `${projectName},${projectStatus},"${todo.text}",已完成,${todo.priority},${todo.progress || '未开始'},${createdDate},${completedDate},${days}\n`;
      });
    });
    
    // 下载文件
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `项目一览_${getLocalDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 渲染工作总结页面（独立页面）
  function renderSummaryPage(): string {
    const theme = themes[todoApp.getTheme()];
    const summaryTodos = todoApp.getCompletedTodos();
    const projects = todoApp.getProjects();
    
    // 按项目分组
    const groupedByProject: Map<number | null, Todo[]> = new Map();
    summaryTodos.forEach(todo => {
      const projectId = todo.projectId;
      if (!groupedByProject.has(projectId)) {
        groupedByProject.set(projectId, []);
      }
      groupedByProject.get(projectId)!.push(todo);
    });
    
    // 按项目名称排序
    const sortedProjects = Array.from(groupedByProject.keys()).sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      const projectA = projects.find(p => isIdEqual(p.id, a));
      const projectB = projects.find(p => isIdEqual(p.id, b));
      return (projectA?.name || '').localeCompare(projectB?.name || '', 'zh-CN');
    });
    
    // 计算总耗时
    let totalDays = 0;
    summaryTodos.forEach(todo => {
      if (todo.createdAt && todo.completedAt) {
        totalDays += calculateDaysBetween(
          todo.createdAt.split('T')[0],
          todo.completedAt.split('T')[0]
        );
      }
    });
    
    return `
      <div class="app-container ${todoApp.getTheme()}" style="min-height: 100vh; background: ${theme.background};">
        <header class="app-header" style="background: ${theme.cardBg};">
          <div class="header-left">
            <button id="back-to-main-btn" class="back-btn" title="返回">
              ${getIcon('arrowLeft')}
            </button>
            <h1 class="header-title">工作总结</h1>
          </div>
          <div class="header-right">
            <span class="summary-stats">共 ${summaryTodos.length} 项任务，总耗时 ${totalDays} 天</span>
            ${summaryTodos.length > 0 ? `<button id="export-summary-btn" class="export-btn" title="导出Excel">${getIcon('download')}导出</button>` : ''}
          </div>
        </header>
        
        <main class="summary-page-content">
          ${summaryTodos.length === 0 ? `
            <div class="empty-state">
              ${getIcon('clipboard')}
              <p>暂无已完成的工作</p>
              <p class="empty-hint">完成任务后会自动归档到这里</p>
            </div>
          ` : `
            <div class="summary-list">
              ${sortedProjects.map(projectId => {
                const todos = groupedByProject.get(projectId)!;
                const project = projectId ? projects.find(p => isIdEqual(p.id, projectId)) : null;
                const projectName = project?.name || '未分类';
                const projectColor = project?.color || '#6B7280';
                
                // 按完成日期分组
                const groupedByDate: Map<string, Todo[]> = new Map();
                todos.forEach(todo => {
                  const dateKey = todo.completedAt ? todo.completedAt.split('T')[0] : '未知日期';
                  if (!groupedByDate.has(dateKey)) {
                    groupedByDate.set(dateKey, []);
                  }
                  groupedByDate.get(dateKey)!.push(todo);
                });
                
                // 日期排序（最新的在前）
                const sortedDates = Array.from(groupedByDate.keys()).sort((a, b) => b.localeCompare(a));
                
                return `
                  <div class="summary-project-card" style="background: ${theme.cardBg};">
                    <div class="summary-project-header" style="border-left-color: ${projectColor};">
                      <span class="summary-project-name" style="color: ${projectColor};">${projectName}</span>
                      <span class="summary-project-count">${todos.length} 项</span>
                    </div>
                    <div class="summary-project-content">
                      ${sortedDates.map(date => {
                        const dateTodos = groupedByDate.get(date)!;
                        return `
                          <div class="summary-date-group">
                            <div class="summary-date-label">
                              ${getIcon('calendar')}
                              <span>完成于 ${date}</span>
                            </div>
                            <div class="summary-todos-list">
                              ${dateTodos.map(todo => {
                                const createdDate = todo.createdAt ? todo.createdAt.split('T')[0] : '未知';
                                const completedDate = todo.completedAt ? todo.completedAt.split('T')[0] : '未知';
                                const days = todo.createdAt && todo.completedAt 
                                  ? calculateDaysBetween(createdDate, completedDate)
                                  : 0;
                                return `
                                  <div class="summary-todo-item" style="background: ${theme.primaryLight};">
                                    <div class="summary-todo-title">${todo.text}</div>
                                    <div class="summary-todo-info">
                                      <div class="summary-todo-dates">
                                        <span class="date-tag start">创建: ${createdDate}</span>
                                        <span class="date-arrow">→</span>
                                        <span class="date-tag end">完成: ${completedDate}</span>
                                      </div>
                                      <span class="summary-days-badge">耗时 ${days} 天</span>
                                    </div>
                                    <div class="summary-todo-actions">
                                      <button class="restore-completed-btn" data-id="${todo.id}" title="退回主界面">${getIcon('undo')}</button>
                                      <button class="delete-completed-btn" data-id="${todo.id}" title="删除">${getIcon('trash')}</button>
                                    </div>
                                  </div>
                                `;
                              }).join('')}
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </main>
      </div>
    `;
  }

  // 渲染回收站模态框
  function renderTrashModal(): string {
    const theme = themes[todoApp.getTheme()];
    const deletedTodos = todoApp.getDeletedTodos();
    const projects = todoApp.getProjects();
    
    return `
      <div class="modal-overlay" id="trash-modal">
        <div class="modal-content trash-modal-content">
          <div class="modal-header">
            <h3>回收站</h3>
            ${deletedTodos.length > 0 ? `<button id="clear-trash-btn" class="clear-trash-btn">清空回收站</button>` : ''}
          </div>
          ${deletedTodos.length === 0 ? `
            <div class="empty-trash">
              ${getIcon('trash2')}
              <p>回收站是空的</p>
            </div>
          ` : `
            <div class="trash-list">
              ${deletedTodos.map(todo => {
                const priorityConf = priorityConfig[todo.priority];
                const progressConfigAll = getProgressConfig(todoApp.getCustomProgressStates());
                const progressConf = progressConfigAll[todo.progress] || { label: todo.progress, color: '#718096', bg: '#E2E8F0' };
                // 获取项目信息：先找现有项目，没有则显示被删除时的项目名
                const project = todo.projectId ? projects.find(p => isIdEqual(p.id, todo.projectId)) : null;
                const projectDisplay = project 
                  ? `<span class="project-badge" style="background: ${project.color}20; color: ${project.color};">${project.name}</span>`
                  : todo.deletedFromProject 
                    ? `<span class="project-badge deleted-project" title="恢复时将自动创建该项目">${todo.deletedFromProject} (已删除)</span>`
                    : '';
                return `
                  <div class="trash-item" style="background: ${theme.cardBg}; border-left: 4px solid ${priorityConf.color};">
                    <div class="trash-item-content">
                      <div class="trash-item-title">${todo.text}</div>
                      <div class="trash-item-meta">
                        ${projectDisplay}
                        <span class="progress-badge" style="background: ${progressConf.bg}; color: ${progressConf.color};">${progressConf.label}</span>
                        ${todo.deletedAt ? `<span class="deleted-time">删除于 ${formatDate(todo.deletedAt)}</span>` : ''}
                      </div>
                    </div>
                    <div class="trash-item-actions">
                      <button class="restore-btn" data-id="${todo.id}" data-todo-unique-id="${todo.uniqueId || ''}" data-todo-text="${todo.text.replace(/"/g, '&quot;')}" title="恢复">${getIcon('restore')}</button>
                      <button class="permanent-delete-btn" data-id="${todo.id}" data-todo-unique-id="${todo.uniqueId || ''}" data-todo-text="${todo.text.replace(/"/g, '&quot;')}" title="永久删除">${getIcon('trash')}</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
          <div class="modal-actions">
            <button id="close-trash-btn" class="modal-btn confirm">关闭</button>
          </div>
        </div>
      </div>
    `;
  }

  // 渲染设置模态框
  function renderSettingsModal() {
    const currentTheme = todoApp.getTheme();
    return `
      <div class="modal-overlay" id="settings-modal">
        <div class="modal-content settings-modal-content">
          <div class="modal-header">
            <h3>设置</h3>
            <button class="modal-close-btn" id="close-settings-btn">${getIcon('x')}</button>
          </div>
          
          <div class="settings-section">
            <h4 class="settings-section-title">${getIcon('palette')} 界面风格</h4>
            <div class="theme-options">
              <div class="theme-option ${currentTheme === 'minimal' ? 'active' : ''}" data-theme="minimal">
                <div class="theme-preview minimal-preview"></div>
                <span>简约</span>
              </div>
              <div class="theme-option ${currentTheme === 'cute' ? 'active' : ''}" data-theme="cute">
                <div class="theme-preview cute-preview"></div>
                <span>可爱</span>
              </div>
              <div class="theme-option ${currentTheme === 'business' ? 'active' : ''}" data-theme="business">
                <div class="theme-preview business-preview"></div>
                <span>商务</span>
              </div>
            </div>
          </div>
          
          <div class="settings-section">
            <h4 class="settings-section-title">${getIcon('lock')} 修改密码</h4>
            <div class="password-form">
              <input type="password" id="old-password" placeholder="原密码" class="modal-input" />
              <input type="password" id="new-password" placeholder="新密码" class="modal-input" />
              <input type="password" id="confirm-password" placeholder="确认新密码" class="modal-input" />
              <button id="confirm-password-btn" class="modal-btn confirm">确认修改</button>
            </div>
          </div>
          
          <div class="settings-section">
            <h4 class="settings-section-title">${getIcon('trash')} 数据管理</h4>
            <div class="data-management-section">
              <p class="data-tip">清除本地数据可以解决数据重复问题，清除后请重新登录。</p>
              <button id="clear-local-data-btn" class="modal-btn danger">
                <span>${getIcon('trash')}</span> 清除本地数据
              </button>
              <button id="clear-all-data-btn" class="modal-btn danger" style="margin-top: 8px;">
                <span>${getIcon('trash')}</span> 清除本地和云端数据
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 渲染项目管理模态框
  function renderProjectModal() {
    const projects = todoApp.getProjects();
    
    return `
      <div class="modal-overlay" id="project-modal">
        <div class="modal-content project-modal-content">
          <div class="modal-header">
            <h3>项目管理</h3>
            <button class="modal-close-btn" id="close-project-modal-header-btn">${getIcon('x')}</button>
          </div>
          
          <div class="project-create-section">
            <h4 class="section-title">创建新项目</h4>
            <div class="project-form">
              <div class="form-row">
                <div class="form-group form-group-name">
                  <label>项目名称</label>
                  <input type="text" id="new-project-name" placeholder="输入项目名称" class="modal-input" />
                </div>
                <div class="form-group form-group-color">
                  <label>颜色</label>
                  <input type="color" id="new-project-color" value="#3B82F6" class="color-picker" title="选择颜色" />
                </div>
                <div class="form-group form-group-priority">
                  <label>优先级</label>
                  <select id="new-project-priority" class="modal-input">
                    <option value="high">🔴 高</option>
                    <option value="medium" selected>🟡 中</option>
                    <option value="low">🟢 低</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>开始日期</label>
                  <input type="date" id="new-project-start-date" class="modal-input" value="${getLocalDateString()}" />
                </div>
                <div class="form-group">
                  <label>计划完成日期</label>
                  <input type="date" id="new-project-end-date" class="modal-input" />
                </div>
                <div class="form-group form-group-progress">
                  <label>当前进度</label>
                  <input type="text" id="new-project-progress" placeholder="如：已完成50%" class="modal-input" />
                </div>
              </div>
              <button id="add-project-btn" class="modal-btn confirm create-btn">
                <span>${getIcon('plus')}</span> 创建项目
              </button>
            </div>
          </div>
          
          <div class="project-list-section">
            <h4 class="section-title">已创建项目 <span class="project-count">${projects.length}</span></h4>
            <div class="project-list" id="project-list">
              ${projects.length === 0 ? `
                <div class="empty-project-tip">
                  ${getIcon('folder')}
                  <p>暂无项目</p>
                  <p class="empty-hint">在上方创建您的第一个项目</p>
                </div>
              ` : projects.map(p => {
                const priorityConf = projectPriorityConfig[p.priority || 'medium'];
                return `
                  <div class="project-item" data-id="${p.id}">
                    <div class="project-item-row">
                      <span class="project-color" style="background: ${p.color};"></span>
                      <span class="project-name-text">${p.name}</span>
                      <span class="project-priority-badge" style="background: ${priorityConf.bg}; color: ${priorityConf.color};">${priorityConf.label}</span>
                      <button class="rename-project-btn" data-id="${p.id}" title="编辑">${getIcon('edit')}</button>
                      <button class="delete-project-btn" data-id="${p.id}" title="删除">${getIcon('trash')}</button>
                    </div>
                    <div class="project-item-details">
                      <div class="detail-item">
                        <span class="detail-label">📅 开始日期</span>
                        <span class="detail-value">${p.startDate || '未设置'}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">🎯 计划完成</span>
                        <span class="detail-value">${p.endDate || '未设置'}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">📊 当前进度</span>
                        <span class="detail-value ${p.progress ? 'has-progress' : ''}">${p.progress || '未设置'}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 渲染快速添加任务模态框
  function renderQuickAddModal(projectId: number | null): string {
    const theme = themes[todoApp.getTheme()];
    const projects = todoApp.getProjects();
    const project = projectId ? projects.find(p => isIdEqual(p.id, projectId)) : null;
    const projectName = project?.name || '未分类';
    const today = getLocalDateString();
    
    return `
      <div class="modal-overlay" id="quick-add-modal">
        <div class="modal-content quick-add-modal">
          <div class="modal-header">
            <h3>添加任务到「${projectName}」</h3>
          </div>
          <input type="text" id="quick-todo-input" class="modal-input" placeholder="输入任务内容，按回车添加" autofocus />
          <div class="quick-add-options">
            <div class="quick-option-group">
              <label>任务优先级</label>
              <select id="quick-priority-select" class="modal-input">
                <option value="high">🔴 高优先级</option>
                <option value="medium" selected>🟡 中优先级</option>
                <option value="low">🟢 低优先级</option>
              </select>
            </div>
            <div class="quick-option-group">
              <label>计划完成日期（可选）</label>
              <input type="date" id="quick-planned-end-date-input" class="modal-input" />
            </div>
          </div>
          <div class="modal-actions">
            <button id="cancel-quick-add-btn" class="modal-btn cancel">取消</button>
            <button id="confirm-quick-add-btn" class="modal-btn confirm">添加</button>
          </div>
        </div>
      </div>
    `;
  }

  // 渲染编辑待办模态框
  function renderEditTodoModal(todoId: number) {
    // 直接从所有任务中查找，不依赖筛选结果
    const allTodos = todoApp.getTodos();
    const todo = allTodos.find(t => isIdEqual(t.id, todoId));
    if (!todo) {
      console.error('找不到任务:', todoId);
      return '';
    }
    
    const projects = todoApp.getProjects();
    
    return `
      <div class="modal-overlay" id="edit-todo-modal">
        <div class="modal-content edit-todo-modal-content">
          <div class="modal-header">
            <h3>编辑任务</h3>
            <button class="modal-close-btn" id="cancel-edit-btn">${getIcon('x')}</button>
          </div>
          
          <input type="text" id="edit-todo-text" value="${todo.text}" class="modal-input" placeholder="任务内容" />
          
          <div class="edit-form-row">
            <div class="edit-form-group">
              <label class="modal-label">所属项目</label>
              <select id="edit-project-select" class="modal-input">
                <option value="uncategorized" ${todo.projectId === null ? 'selected' : ''}>未分类</option>
                ${projects.map(p => `<option value="${p.id}" ${todo.projectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
            </div>
            <div class="edit-form-group">
              <label class="modal-label">任务优先级</label>
              <select id="edit-priority-select" class="modal-input">
                <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>🔴 高优先级</option>
                <option value="medium" ${todo.priority === 'medium' ? 'selected' : ''}>🟡 中优先级</option>
                <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>🟢 低优先级</option>
              </select>
            </div>
          </div>
          
          <div class="edit-form-row">
            <div class="edit-form-group">
              <label class="modal-label">开始日期</label>
              <input type="date" id="edit-start-date" value="${todo.startDate || todo.createdAt?.split('T')[0] || ''}" class="modal-input" />
            </div>
            <div class="edit-form-group">
              <label class="modal-label">计划完成日期</label>
              <input type="date" id="edit-planned-end-date-input" value="${todo.endDate || ''}" class="modal-input" />
            </div>
          </div>
          
          <div class="edit-form-row">
            <div class="edit-form-group" style="flex: 1;">
              <label class="modal-label">当前进度</label>
              <input type="text" id="edit-progress-input" value="${todo.progress || ''}" class="modal-input" placeholder="例如：已完成50%、等待审批中..." />
            </div>
          </div>
          
          <div class="modal-actions">
            <button id="save-edit-btn" data-id="${todo.id}" class="modal-btn confirm full-width">保存修改</button>
          </div>
        </div>
      </div>
    `;
  }

  // 渲染图表（商务风格）
  function renderChart(stats: { total: number; completed: number; pending: number; percentage: number }, projectStats: any[]) {
    const maxHeight = 150;
    const maxTotal = Math.max(stats.total, 1);
    
    return `
      <div class="chart-container">
        <h4>任务统计图表</h4>
        <div class="bar-chart">
          <div class="bar-item">
            <div class="bar" style="height: ${Math.max(10, (stats.total / maxTotal) * maxHeight)}px; background: #3B82F6;"></div>
            <span class="bar-label">总任务 (${stats.total})</span>
          </div>
          <div class="bar-item">
            <div class="bar" style="height: ${Math.max(10, (stats.completed / maxTotal) * maxHeight)}px; background: #10B981;"></div>
            <span class="bar-label">已完成 (${stats.completed})</span>
          </div>
          <div class="bar-item">
            <div class="bar" style="height: ${Math.max(10, (stats.pending / maxTotal) * maxHeight)}px; background: #F59205;"></div>
            <span class="bar-label">未完成 (${stats.pending})</span>
          </div>
        </div>
        ${projectStats.length > 0 ? `
          <h4 style="margin-top: 20px;">项目完成率</h4>
          <div class="bar-chart">
            ${projectStats.map(ps => `
              <div class="bar-item">
                <div class="bar" style="height: ${Math.max(10, (ps.percentage / 100) * maxHeight)}px; background: ${ps.color};"></div>
                <span class="bar-label">${ps.name} (${ps.percentage}%)</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // 图标
  function getIcon(name: string): string {
    const icons: { [key: string]: string } = {
      lock: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
      settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
      logout: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
      list: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
      check: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      clock: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
      percent: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>`,
      trash: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
      trash2: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
      restore: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`,
      inbox: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 1 2 2h16a2 2 0 0 1-2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`,
      folder: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
      edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
      calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
      chevron: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
      plus: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
      clipboard: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
      x: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
      undo: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>`,
      download: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
      arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
      chart: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
      minimize: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
      chevronUp: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
      zap: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
      refresh: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>`,
    };
    return icons[name] || '';
  }

  // 云端登录事件处理
  async function attachCloudLoginListeners(mode: 'login' | 'register') {
    const submitBtn = document.getElementById('cloud-submit-btn');
    const emailInput = document.getElementById('cloud-email-input') as HTMLInputElement;
    const passwordInput = document.getElementById('cloud-password-input') as HTMLInputElement;
    const passwordConfirm = document.getElementById('cloud-password-confirm') as HTMLInputElement;
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');
    const backToLocalBtn = document.getElementById('back-to-local-btn');

    if (submitBtn && emailInput && passwordInput) {
      submitBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
          if (app) app.innerHTML = renderCloudLogin(mode, '请填写邮箱和密码');
          attachCloudLoginListeners(mode);
          return;
        }

        if (mode === 'register' && passwordConfirm) {
          if (password !== passwordConfirm.value) {
            if (app) app.innerHTML = renderCloudLogin(mode, '两次输入的密码不一致');
            attachCloudLoginListeners(mode);
            return;
          }
        }

        try {
          submitBtn.textContent = '处理中...';
          (submitBtn as HTMLButtonElement).disabled = true;

          // 直接调用Supabase客户端
          const { signIn, signUp } = await import('./storage/database/supabase-client');
          const result = mode === 'login' 
            ? await signIn(email, password)
            : await signUp(email, password);

          const { data, error } = result;

          if (error) {
            if (app) app.innerHTML = renderCloudLogin(mode, error.message || '登录/注册失败');
            attachCloudLoginListeners(mode);
            return;
          }

          if (data.session && data.user) {
            // 保存认证信息
            localStorage.setItem('cloud_session', JSON.stringify(data.session));
            localStorage.setItem('cloud_user', JSON.stringify(data.user));
            
            console.log('云端登录成功!');
            console.log('用户ID:', data.user.id);
            console.log('用户邮箱:', data.user.email);
            
            // 设置云端模式
            todoApp.setCloudMode(true, data.user.id);
            
            // 同步本地数据到云端
            await syncLocalToCloud();
            
            render();
          } else if (mode === 'register' && data.user) {
            if (app) app.innerHTML = renderCloudLogin('login', '注册成功！请查收验证邮件后登录');
            attachCloudLoginListeners('login');
          }
        } catch (err) {
          console.error('Auth error:', err);
          if (app) app.innerHTML = renderCloudLogin(mode, '网络错误，请检查连接后重试');
          attachCloudLoginListeners(mode);
        }
      });

      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitBtn.click();
      });
      
      if (passwordConfirm) {
        passwordConfirm.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') submitBtn.click();
        });
      }
    }

    if (switchToRegister && app) {
      switchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        app.innerHTML = renderCloudLogin('register');
        attachCloudLoginListeners('register');
      });
    }

    if (switchToLogin && app) {
      switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        app.innerHTML = renderCloudLogin('login');
        attachCloudLoginListeners('login');
      });
    }

    if (backToLocalBtn && app) {
      backToLocalBtn.addEventListener('click', () => {
        render();
      });
    }
  }
  
  // 同步本地和云端数据
  // 策略：云端权威 + 时间戳比较
  // 1. 上传时：本地.updatedAt > 云端.updatedAt 才更新云端
  // 2. 下载时：用云端数据覆盖本地（云端是权威）
  // 3. 墓碑机制：deleted_todos 表记录已删除任务，同步时过滤
  async function syncLocalToCloud() {
    todoApp.setSkipSyncCallback(true);
    
    try {
      const { dataService } = await import('./storage/database/data-service');
      const userId = todoApp.getCloudUserId();
      if (!userId) {
        console.log('未登录云端，跳过同步');
        return;
      }
      
      console.log('========== 开始数据同步（云端权威模式）==========');
      
      // ========== 第一步：获取云端和本地数据 ==========
      let [cloudProjects, cloudTodos, cloudCompleted, cloudDeleted] = await Promise.all([
        dataService.projects.getProjects(userId).catch((e) => { console.error('获取云端项目失败:', e); return [] as any[]; }),
        dataService.todos.getTodos(userId).catch((e) => { console.error('获取云端任务失败:', e); return [] as any[]; }),
        dataService.completedTodos.getCompletedTodos(userId).catch((e) => { console.error('获取云端已完成任务失败:', e); return [] as any[]; }),
        dataService.deletedTodos.getDeletedTodos(userId).catch((e) => { console.error('获取云端删除记录失败:', e); return [] as any[]; }),
      ]);
      
      const localProjects: Project[] = JSON.parse(localStorage.getItem('todo_projects') || '[]');
      const localTodos: Todo[] = JSON.parse(localStorage.getItem('todo_todos') || '[]');
      const localCompleted: Todo[] = JSON.parse(localStorage.getItem('todo_completed_todos') || '[]');
      const localDeleted: Todo[] = JSON.parse(localStorage.getItem('todo_deleted_todos') || '[]');
      
      console.log('数据状态:', {
        云端: { projects: cloudProjects.length, todos: cloudTodos.length, completed: cloudCompleted.length, deleted: cloudDeleted.length },
        本地: { projects: localProjects.length, todos: localTodos.length, completed: localCompleted.length, deleted: localDeleted.length }
      });
      
      // 安全检查：如果云端数据全部为空，且本地有数据，则不同步（可能是网络问题）
      const cloudAllEmpty = cloudProjects.length === 0 && cloudTodos.length === 0 && cloudCompleted.length === 0;
      const localHasData = localProjects.length > 0 || localTodos.length > 0 || localCompleted.length > 0;
      if (cloudAllEmpty && localHasData) {
        console.log('⚠️ 云端数据为空，本地有数据，跳过同步以保护本地数据');
        return;
      }
      
      // ========== 第二步：构建已删除任务集合（墓碑机制） ==========
      // 合并云端和本地的已删除记录，任何在此集合中的任务都应被删除
      const deletedUniqueIds = new Set<string>();
      cloudDeleted.forEach(t => t.unique_id && deletedUniqueIds.add(t.unique_id));
      localDeleted.forEach(t => t.uniqueId && deletedUniqueIds.add(t.uniqueId));
      console.log('墓碑集合大小:', deletedUniqueIds.size);
      
      // ========== 第三步：上传本地数据到云端（时间戳比较） ==========
      
      // 3.1 同步项目
      const cloudProjectMap = new Map<string, any>();
      cloudProjects.forEach(p => p.unique_id && cloudProjectMap.set(p.unique_id, p));
      
      for (const localProj of localProjects) {
        if (!localProj.uniqueId) continue;
        
        // 检查项目是否在墓碑列表中（已删除）
        if (deletedUniqueIds.has(localProj.uniqueId)) {
          console.log('跳过墓碑项目:', localProj.name);
          continue;
        }
        
        const cloudProj = cloudProjectMap.get(localProj.uniqueId);
        const localUpdated = new Date(localProj.updatedAt || 0).getTime();
        const cloudUpdated = cloudProj ? new Date(cloudProj.updated_at || cloudProj.created_at || 0).getTime() : 0;
        
        if (!cloudProj) {
          // 云端没有，上传
          try {
            await dataService.projects.createProject(userId, {
              unique_id: localProj.uniqueId,
              name: localProj.name,
              color: localProj.color,
              priority: localProj.priority,
              start_date: localProj.startDate || null,
              end_date: localProj.endDate || null,
              progress: localProj.progress || null,
              completed: localProj.completed || false,
            });
            console.log('✓ 上传项目:', localProj.name);
          } catch (e) { console.error('✗ 上传项目失败:', localProj.name, e); }
        } else if (localUpdated > cloudUpdated) {
          // 本地更新，更新云端
          try {
            await dataService.projects.updateProject(cloudProj.id, {
              name: localProj.name,
              color: localProj.color,
              priority: localProj.priority,
              start_date: localProj.startDate || null,
              end_date: localProj.endDate || null,
              progress: localProj.progress || null,
              completed: localProj.completed || false,
            });
            console.log('✓ 更新云端项目:', localProj.name);
          } catch (e) { console.error('✗ 更新云端项目失败:', localProj.name, e); }
        }
      }
      
      // 重新获取云端项目，建立映射
      cloudProjects = await dataService.projects.getProjects(userId).catch(() => []);
      const uniqueIdToCloudProjectId = new Map<string, string>();
      const cloudProjectIdToUniqueId = new Map<string, string>();
      cloudProjects.forEach(p => {
        if (p.unique_id) {
          uniqueIdToCloudProjectId.set(p.unique_id, p.id);
          cloudProjectIdToUniqueId.set(p.id, p.unique_id);
        }
      });
      
      // 3.2 同步任务
      const cloudTodoMap = new Map<string, any>();
      cloudTodos.forEach(t => t.unique_id && cloudTodoMap.set(t.unique_id, t));
      
      for (const localTodo of localTodos) {
        if (!localTodo.uniqueId) continue;
        
        // 如果在墓碑集合中，跳过
        if (deletedUniqueIds.has(localTodo.uniqueId)) continue;
        
        const cloudTodo = cloudTodoMap.get(localTodo.uniqueId);
        const localUpdated = new Date(localTodo.updatedAt || localTodo.createdAt || 0).getTime();
        const cloudUpdated = cloudTodo ? new Date(cloudTodo.updated_at || cloudTodo.created_at || 0).getTime() : 0;
        
        // 获取项目云端ID
        let cloudProjectId: string | null = null;
        if (localTodo.projectId) {
          const localProj = localProjects.find(p => isIdEqual(p.id, localTodo.projectId));
          if (localProj?.uniqueId) {
            cloudProjectId = uniqueIdToCloudProjectId.get(localProj.uniqueId) || null;
          }
        }
        
        if (!cloudTodo) {
          // 云端没有，上传
          try {
            await dataService.todos.createTodo(userId, {
              unique_id: localTodo.uniqueId,
              text: localTodo.text,
              completed: localTodo.completed,
              priority: localTodo.priority,
              progress: localTodo.progress || null,
              end_date: localTodo.endDate || null,
              completed_at: localTodo.completedAt || null,
              project_id: cloudProjectId,
            });
            console.log('✓ 上传任务:', localTodo.text);
          } catch (e) { console.error('✗ 上传任务失败:', localTodo.text, e); }
        } else if (localUpdated > cloudUpdated) {
          // 本地更新，更新云端
          try {
            await dataService.todos.updateTodo(cloudTodo.id, {
              text: localTodo.text,
              completed: localTodo.completed,
              priority: localTodo.priority,
              progress: localTodo.progress || null,
              end_date: localTodo.endDate || null,
              completed_at: localTodo.completedAt || null,
              project_id: cloudProjectId,
            });
            console.log('✓ 更新云端任务:', localTodo.text);
          } catch (e) { console.error('✗ 更新云端任务失败:', localTodo.text, e); }
        }
      }
      
      // 3.3 同步已完成任务
      const cloudCompletedMap = new Map<string, any>();
      cloudCompleted.forEach(t => t.unique_id && cloudCompletedMap.set(t.unique_id, t));
      
      for (const localC of localCompleted) {
        if (!localC.uniqueId) continue;
        if (deletedUniqueIds.has(localC.uniqueId)) continue;
        
        const cloudC = cloudCompletedMap.get(localC.uniqueId);
        if (!cloudC) {
          try {
            await dataService.completedTodos.createCompletedTodo(userId, {
              unique_id: localC.uniqueId,
              project_id: null,
              text: localC.text,
              priority: localC.priority,
              progress: localC.progress || null,
              completed_at: localC.completedAt || new Date().toISOString(),
            });
            console.log('✓ 上传已完成任务:', localC.text);
          } catch (e) { console.error('✗ 上传已完成任务失败:', e); }
        }
      }
      
      // 3.4 同步已删除任务（只上传墓碑 unique_id，不下载到回收站）
      const cloudDeletedMap = new Map<string, any>();
      cloudDeleted.forEach(t => t.unique_id && cloudDeletedMap.set(t.unique_id, t));
      
      for (const localD of localDeleted) {
        if (!localD.uniqueId) continue;
        if (!cloudDeletedMap.has(localD.uniqueId)) {
          try {
            // 只上传 unique_id 作为墓碑，不需要完整信息
            await dataService.deletedTodos.createDeletedTodo(userId, {
              unique_id: localD.uniqueId,
            });
            console.log('✓ 上传墓碑记录:', localD.text);
          } catch (e) { console.error('✗ 上传墓碑记录失败:', e); }
        }
      }
      
      // 3.5 清理：删除云端在墓碑集合中的任务
      for (const cloudTodo of cloudTodos) {
        if (cloudTodo.unique_id && deletedUniqueIds.has(cloudTodo.unique_id)) {
          try {
            await dataService.todos.deleteTodo(cloudTodo.id);
            console.log('✓ 清理云端任务（墓碑）:', cloudTodo.text);
          } catch (e) { console.error('✗ 清理云端任务失败:', e); }
        }
      }
      
      // ========== 第四步：从云端拉取最新数据（云端权威） ==========
      [cloudProjects, cloudTodos, cloudCompleted, cloudDeleted] = await Promise.all([
        dataService.projects.getProjects(userId).catch(() => [] as any[]),
        dataService.todos.getTodos(userId).catch(() => [] as any[]),
        dataService.completedTodos.getCompletedTodos(userId).catch(() => [] as any[]),
        dataService.deletedTodos.getDeletedTodos(userId).catch(() => [] as any[]),
      ]);
      
      // 更新墓碑集合
      cloudDeleted.forEach(t => t.unique_id && deletedUniqueIds.add(t.unique_id));
      
      // ========== 第五步：构建本地数据（直接用云端数据覆盖） ==========
      
      // 建立项目映射（过滤墓碑项目）
      const projectIdMap = new Map<string, number>();
      const mergedProjects: Project[] = cloudProjects
        .filter(p => !deletedUniqueIds.has(p.unique_id)) // 过滤掉墓碑项目
        .map((p, index) => {
          const proj = {
            id: index + 1,
            uniqueId: p.unique_id || generateUniqueId(),
            cloudId: p.id,
            name: p.name,
            color: p.color,
            priority: p.priority,
            startDate: p.start_date || null,
            endDate: p.end_date || null,
            progress: p.progress || '',
            completed: p.completed || false,
            updatedAt: p.updated_at || p.created_at || new Date().toISOString()
          };
          if (p.unique_id) projectIdMap.set(p.unique_id, proj.id);
          return proj;
        });
      
      // 建立项目云端ID到本地ID的映射
      const cloudProjectIdToLocalId = new Map<string, number>();
      cloudProjects.forEach((p, index) => {
        if (p.unique_id && projectIdMap.has(p.unique_id)) {
          cloudProjectIdToLocalId.set(p.id, projectIdMap.get(p.unique_id)!);
        }
      });
      
      // 构建任务列表（过滤墓碑）
      const mergedTodos: Todo[] = cloudTodos
        .filter(t => !deletedUniqueIds.has(t.unique_id))
        .map(t => ({
          id: parseFloat(t.id) || Date.now() + Math.random(),
          uniqueId: t.unique_id || generateUniqueId(),
          cloudId: t.id,
          projectId: t.project_id ? (cloudProjectIdToLocalId.get(t.project_id) || null) : null,
          text: t.text,
          completed: t.completed,
          priority: t.priority,
          progress: t.progress || '',
          deadline: null,
          startDate: t.created_at?.split('T')[0] || null,
          endDate: t.end_date || null,
          createdAt: t.created_at || new Date().toISOString(),
          updatedAt: t.updated_at || t.created_at || new Date().toISOString(),
          completedAt: t.completed_at
        }));
      
      // 构建已完成任务列表（过滤墓碑）
      const mergedCompleted: Todo[] = cloudCompleted
        .filter(t => !deletedUniqueIds.has(t.unique_id))
        .map(t => ({
          id: parseFloat(t.id) || Date.now() + Math.random(),
          uniqueId: t.unique_id || generateUniqueId(),
          cloudId: t.id,
          projectId: null,
          text: t.text,
          completed: true,
          priority: t.priority,
          progress: t.progress || '',
          deadline: null,
          startDate: t.created_at?.split('T')[0] || null,
          endDate: null,
          createdAt: t.created_at || new Date().toISOString(),
          updatedAt: t.completed_at || new Date().toISOString(),
          completedAt: t.completed_at
        }));
      
      // 构建已删除任务列表
      // 注意：云端 deleted_todos 只作为墓碑使用，不下载到本地回收站
      // 本地回收站数据保留在本地，不与云端同步
      // 这样可以避免历史删除的任务在同步后重新出现在回收站
      const mergedDeleted: Todo[] = localDeleted;
      
      // ========== 第六步：保存到本地 ==========
      console.log('同步结果:', {
        projects: mergedProjects.length,
        todos: mergedTodos.length,
        completed: mergedCompleted.length,
        deleted: mergedDeleted.length
      });
      
      localStorage.setItem('todo_projects', JSON.stringify(mergedProjects));
      localStorage.setItem('todo_todos', JSON.stringify(mergedTodos));
      localStorage.setItem('todo_completed_todos', JSON.stringify(mergedCompleted));
      localStorage.setItem('todo_deleted_todos', JSON.stringify(mergedDeleted));
      
      todoApp.reloadData();
      console.log('========== 数据同步完成 ==========');
      
    } catch (err) {
      console.error('数据同步失败:', err);
    } finally {
      todoApp.setSkipSyncCallback(false);
    }
  }

  // 渲染应用
  let isFirstRender = true;
  async function render() {
    if (!app) return;
    
    if (todoApp.isAuthenticated()) {
      app.innerHTML = renderMain();
      
      // 首次渲染时，如果是云端模式，自动同步数据
      if (isFirstRender && todoApp.isCloudMode()) {
        isFirstRender = false;
        // 异步同步，不阻塞渲染
        syncLocalToCloud().then(() => {
          // 同步完成后重新渲染
          console.log('同步完成，重新渲染页面...');
          app.innerHTML = renderMain();
          attachEventListeners();
        }).catch(err => {
          console.error('自动同步失败:', err);
        });
      }
    } else {
      app.innerHTML = renderLogin();
    }
    attachEventListeners();
  }

  // 附加事件监听器
  function attachEventListeners() {
    // 登录相关
    const loginBtn = document.getElementById('login-btn');
    const passwordInput = document.getElementById('password-input') as HTMLInputElement;

    if (loginBtn && passwordInput) {
      loginBtn.addEventListener('click', async () => {
        if (todoApp.login(passwordInput.value)) {
          // 本地登录成功后，检查是否有云端会话，如果有则同步数据
          const cloudSession = localStorage.getItem('cloud_user');
          console.log('本地登录成功，检查云端会话:', !!cloudSession);
          if (cloudSession) {
            try {
              const user = JSON.parse(cloudSession);
              console.log('设置云端模式，用户ID:', user.id);
              todoApp.setCloudMode(true, user.id);
              await syncLocalToCloud();
              console.log('同步完成，重新渲染');
              render();
            } catch (e) {
              console.error('同步失败:', e);
            }
          } else {
            render();
          }
        } else {
          alert('密码错误！');
        }
      });

      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          loginBtn.click();
        }
      });
    }

    // 云端登录按钮
    const cloudLoginBtn = document.getElementById('cloud-login-btn');
    if (cloudLoginBtn && app) {
      cloudLoginBtn.addEventListener('click', () => {
        app.innerHTML = renderCloudLogin('login');
        attachCloudLoginListeners('login');
      });
    }

    // 登出
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
          todoApp.logout();
          render();
        }
      });
    }

    // 回收站
    const trashBtn = document.getElementById('trash-btn');
    if (trashBtn && app) {
      trashBtn.addEventListener('click', () => {
        app.innerHTML += renderTrashModal();
        attachTrashModalListeners();
      });
    }

    // 设置
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn && app) {
      settingsBtn.addEventListener('click', () => {
        app.innerHTML += renderSettingsModal();
        attachSettingsModalListeners();
      });
    }

    // 同步数据
    const syncBtn = document.getElementById('sync-btn');
    if (syncBtn && app) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.innerHTML = getIcon('refresh') + ' 同步中...';
        try {
          await syncLocalToCloud();
          render();
          alert('数据同步成功！');
        } catch (e) {
          console.error('同步失败:', e);
          alert('同步失败: ' + (e as Error).message);
        }
      });
    }

    // 项目管理
    const projectManageBtn = document.getElementById('project-manage-btn');
    if (projectManageBtn && app) {
      projectManageBtn.addEventListener('click', () => {
        app.innerHTML += renderProjectModal();
        attachProjectModalListeners();
      });
    }

    // 项目一览
    const projectOverviewBtn = document.getElementById('project-overview-btn');
    if (projectOverviewBtn && app) {
      projectOverviewBtn.addEventListener('click', () => {
        // 跳转到项目一览页面
        renderProjectOverviewPageView();
      });
    }

    // 工作总结
    const summaryBtn = document.getElementById('summary-btn');
    if (summaryBtn && app) {
      summaryBtn.addEventListener('click', () => {
        // 跳转到工作总结页面
        renderSummaryPageView();
      });
    }

    // 添加待办事项
    const addTodoBtn = document.getElementById('add-todo-btn');
    const todoInput = document.getElementById('todo-input') as HTMLInputElement;
    const projectSelect = document.getElementById('project-select') as HTMLSelectElement;
    const prioritySelect = document.getElementById('priority-select') as HTMLSelectElement;
    const plannedEndDateInput = document.getElementById('planned-end-date-input') as HTMLInputElement;

    if (addTodoBtn && todoInput) {
      addTodoBtn.addEventListener('click', () => {
        const text = todoInput.value.trim();
        const plannedEndDate = plannedEndDateInput?.value || null;
        const priority = (prioritySelect?.value || 'medium') as 'high' | 'medium' | 'low';
        
        if (!text) {
          alert('请输入任务内容！');
          return;
        }
        
        const projectValue = projectSelect?.value;
        const projectId = (projectValue && projectValue !== 'uncategorized') ? parseFloat(projectValue) : null;
        todoApp.addTodo(text, projectId, plannedEndDate, priority);
        todoInput.value = '';
        if (projectSelect) projectSelect.value = 'uncategorized';
        if (prioritySelect) prioritySelect.value = 'medium';
        if (plannedEndDateInput) plannedEndDateInput.value = '';
        render();
      });

      todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addTodoBtn.click();
        }
      });
    }

    // 快速创建项目按钮
    const quickCreateProjectBtn = document.getElementById('quick-create-project-btn');
    if (quickCreateProjectBtn && app) {
      quickCreateProjectBtn.addEventListener('click', () => {
        app.innerHTML += renderProjectModal();
        attachProjectModalListeners();
      });
    }

    // 筛选
    // 项目筛选
    const projectFilter = document.getElementById('project-filter') as HTMLSelectElement;
    if (projectFilter) {
      projectFilter.addEventListener('change', () => {
        const value = projectFilter.value;
        if (value === 'all') {
          todoApp.setProjectFilter('all');
        } else if (value === 'uncategorized') {
          todoApp.setProjectFilter('uncategorized');
        } else {
          todoApp.setProjectFilter(parseFloat(value));
        }
        render();
      });
    }

    // 排序
    const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        todoApp.setSortBy(sortSelect.value as SortType);
        render();
      });
    }

    // 项目组批量管理按钮
    document.querySelectorAll('.group-batch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const projectIdStr = (e.currentTarget as HTMLElement).dataset.projectId;
        const projectId = projectIdStr === 'null' ? null : parseFloat(projectIdStr || '0');
        todoApp.toggleBatchMode(projectId);
        render();
      });
    });

    // 项目组内全选按钮
    document.querySelectorAll('.select-all-in-group-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const projectIdStr = (e.currentTarget as HTMLElement).dataset.projectId;
        const projectId = projectIdStr === 'null' ? null : parseFloat(projectIdStr || '0');
        todoApp.selectAllTodosInProject(projectId);
        render();
      });
    });

    // 取消全选按钮
    document.querySelectorAll('.deselect-all-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        todoApp.deselectAllTodos();
        render();
      });
    });

    // 项目组批量删除按钮
    document.querySelectorAll('.batch-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const count = todoApp.getSelectedCount();
        if (count > 0) {
          // 批量删除需要云端同步
          const selectedIds = todoApp.getSelectedTodoIds();
          for (const id of selectedIds) {
            const todo = todoApp.getTodos().find(t => t.id === id);
            if (todo && todo.uniqueId) {
              await deleteTodoFromMainWithSync(id, todo.uniqueId, todo.text);
            } else {
              todoApp.deleteTodo(id);
            }
          }
          todoApp.deselectAllTodos();
          render();
        }
      });
    });

    // 批量选择复选框
    document.querySelectorAll('.batch-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const id = parseFloat((e.target as HTMLInputElement).dataset.id || '0');
        todoApp.toggleTodoSelection(id);
        render();
      });
    });

    // 分组折叠/展开
    document.querySelectorAll('.group-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // 如果点击的是添加按钮或编辑项目按钮，不触发展开/折叠
        if ((e.target as HTMLElement).closest('.group-add-btn') || (e.target as HTMLElement).closest('.group-edit-project-btn')) {
          return;
        }
        const projectIdStr = (e.currentTarget as HTMLElement).dataset.projectId;
        const projectId = projectIdStr === 'null' ? null : parseFloat(projectIdStr || '0');
        todoApp.toggleGroupCollapse(projectId);
        render();
      });
    });

    // 分组编辑项目按钮
    document.querySelectorAll('.group-edit-project-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const projectIdStr = (e.currentTarget as HTMLElement).dataset.projectId;
        const projectId = parseFloat(projectIdStr || '0');
        const project = todoApp.getProjects().find(p => isIdEqual(p.id, projectId));
        if (project) {
          showEditProjectModal(project);
        }
      });
    });

    // 分组添加任务按钮
    document.querySelectorAll('.group-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const projectIdStr = (e.currentTarget as HTMLElement).dataset.projectId;
        const projectId = projectIdStr === 'null' ? null : parseFloat(projectIdStr || '0');
        if (app) {
          app.innerHTML += renderQuickAddModal(projectId);
          attachQuickAddModalListeners(projectId);
        }
      });
    });

    // 使用事件委托处理任务列表的事件（更高效，支持大量任务）
    const todoListContainer = document.querySelector('.todos-list');
    if (todoListContainer) {
      // 移除旧的事件监听器（如果有）
      todoListContainer.removeEventListener('click', handleTodoListClick);
      todoListContainer.removeEventListener('touchend', handleTodoListClick);
      todoListContainer.removeEventListener('change', handleTodoListChange);
      
      // 添加新的事件监听器
      todoListContainer.addEventListener('click', handleTodoListClick);
      todoListContainer.addEventListener('touchend', handleTodoListClick, { passive: false });
      todoListContainer.addEventListener('change', handleTodoListChange);
    }
    
    // 悬浮任务窗口相关事件
    attachFloatingWidgetListeners();
  }
  
  // 任务列表点击事件委托处理
  async function handleTodoListClick(e: Event) {
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest('.delete-btn');
    const editBtn = target.closest('.edit-btn');
    
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const idStr = deleteBtn.getAttribute('data-id');
      const uniqueId = deleteBtn.getAttribute('data-todo-unique-id') || '';
      const todoText = deleteBtn.getAttribute('data-todo-text') || '';
      
      if (!idStr) return;
      const id = parseFloat(idStr);
      console.log('删除任务:', id, 'uniqueId:', uniqueId);
      
      // 调用同步删除函数
      await deleteTodoFromMainWithSync(id, uniqueId, todoText);
      render();
      return;
    }
    
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const idStr = editBtn.getAttribute('data-id');
      if (!idStr) return;
      const id = parseFloat(idStr);
      console.log('编辑任务:', id, '原始字符串:', idStr);
      if (app) {
        app.innerHTML += renderEditTodoModal(id);
        attachEditTodoModalListeners();
      }
      return;
    }
  }
  
    // 任务列表变更事件委托处理（复选框）
  function handleTodoListChange(e: Event) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('todo-checkbox')) {
      const id = parseFloat((target as HTMLInputElement).dataset.id || '0');
      console.log('切换任务状态:', id);
      todoApp.toggleTodo(id);
      render();
    }
  }
  
  // 悬浮任务窗口事件监听
  function attachFloatingWidgetListeners() {
    const floatingWidget = document.getElementById('floating-widget');
    const floatingTrigger = document.getElementById('floating-trigger');
    const floatingHeader = document.getElementById('floating-header');
    const floatingMinimize = document.getElementById('floating-minimize');
    const floatingToggleList = document.getElementById('floating-toggle-list');
    const floatingCollapseList = document.getElementById('floating-collapse-list');
    const floatingTaskList = document.getElementById('floating-task-list');
    const floatingAddBtn = document.getElementById('floating-add-btn');
    const floatingTodoInput = document.getElementById('floating-todo-input') as HTMLInputElement;
    const floatingProjectSelect = document.getElementById('floating-project-select') as HTMLSelectElement;
    const floatingPrioritySelect = document.getElementById('floating-priority-select') as HTMLSelectElement;
    const floatingDateInput = document.getElementById('floating-date-input') as HTMLInputElement;
    
    // 悬浮触发按钮点击
    if (floatingTrigger && floatingWidget) {
      floatingTrigger.addEventListener('click', () => {
        floatingWidget.classList.remove('minimized');
        floatingTrigger.classList.add('hidden');
        if (floatingTodoInput) {
          floatingTodoInput.focus();
        }
      });
    }
    
    // 最小化按钮
    if (floatingMinimize && floatingWidget && floatingTrigger) {
      floatingMinimize.addEventListener('click', () => {
        floatingWidget.classList.add('minimized');
        floatingTrigger.classList.remove('hidden');
      });
    }
    
    // 展开/收起任务列表
    if (floatingToggleList && floatingTaskList) {
      floatingToggleList.addEventListener('click', () => {
        floatingTaskList.classList.toggle('expanded');
      });
    }
    
    if (floatingCollapseList && floatingTaskList) {
      floatingCollapseList.addEventListener('click', () => {
        floatingTaskList.classList.remove('expanded');
      });
    }
    
    // 添加任务
    if (floatingAddBtn && floatingTodoInput) {
      const addFloatingTodo = () => {
        const text = floatingTodoInput.value.trim();
        const plannedEndDate = floatingDateInput?.value || null;
        const priority = (floatingPrioritySelect?.value || 'medium') as 'high' | 'medium' | 'low';
        
        if (!text) {
          alert('请输入任务内容！');
          return;
        }
        
        const projectValue = floatingProjectSelect?.value;
        const projectId = (projectValue && projectValue !== 'uncategorized') ? parseFloat(projectValue) : null;
        todoApp.addTodo(text, projectId, plannedEndDate, priority);
        floatingTodoInput.value = '';
        if (floatingProjectSelect) floatingProjectSelect.value = 'uncategorized';
        if (floatingPrioritySelect) floatingPrioritySelect.value = 'medium';
        if (floatingDateInput) floatingDateInput.value = '';
        
        // 刷新悬浮窗口任务列表
        updateFloatingTaskList();
        
        // 同时刷新主界面
        render();
      };
      
      floatingAddBtn.addEventListener('click', addFloatingTodo);
      
      floatingTodoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addFloatingTodo();
        }
      });
    }
    
    // 悬浮窗口任务复选框
    document.querySelectorAll('.floating-task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const id = parseFloat((e.target as HTMLInputElement).dataset.id || '0');
        todoApp.toggleTodo(id);
        updateFloatingTaskList();
        render();
      });
    });
    
    // 拖动功能
    if (floatingHeader && floatingWidget) {
      let isDragging = false;
      let currentX: number;
      let currentY: number;
      let initialX: number;
      let initialY: number;
      let xOffset = 0;
      let yOffset = 0;
      
      floatingHeader.addEventListener('mousedown', (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
        floatingWidget.style.transition = 'none';
      });
      
      document.addEventListener('mousemove', (e: MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        floatingWidget.style.transform = `translate(${currentX}px, ${currentY}px)`;
      });
      
      document.addEventListener('mouseup', () => {
        isDragging = false;
        floatingWidget.style.transition = '';
      });
      
      // 触摸设备支持
      floatingHeader.addEventListener('touchstart', (e: TouchEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const touch = e.touches[0];
        initialX = touch.clientX - xOffset;
        initialY = touch.clientY - yOffset;
        isDragging = true;
        floatingWidget.style.transition = 'none';
      });
      
      document.addEventListener('touchmove', (e: TouchEvent) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        currentX = touch.clientX - initialX;
        currentY = touch.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        floatingWidget.style.transform = `translate(${currentX}px, ${currentY}px)`;
      });
      
      document.addEventListener('touchend', () => {
        isDragging = false;
        floatingWidget.style.transition = '';
      });
    }
  }
  
  // 更新悬浮窗口任务列表
  function updateFloatingTaskList() {
    const listContent = document.getElementById('floating-list-content');
    if (listContent) {
      listContent.innerHTML = renderFloatingTaskList();
      
      // 重新绑定复选框事件
      document.querySelectorAll('.floating-task-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const id = parseFloat((e.target as HTMLInputElement).dataset.id || '0');
          todoApp.toggleTodo(id);
          updateFloatingTaskList();
          render();
        });
      });
    }
  }

  // 渲染工作总结页面视图
  function renderSummaryPageView() {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = renderSummaryPage();
      attachSummaryPageListeners();
    }
  }

  // 工作总结页面事件监听
  function attachSummaryPageListeners() {
    const backBtn = document.getElementById('back-to-main-btn');
    
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        render(); // 返回主页面
      });
    }
    
    // 退回主界面按钮
    document.querySelectorAll('.restore-completed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseFloat((e.currentTarget as HTMLElement).dataset.id || '0');
        if (confirm('确定要将此任务退回主界面吗？')) {
          todoApp.restoreCompletedTodo(id);
          renderSummaryPageView(); // 刷新当前页面
        }
      });
    });
    
    // 删除已完成任务按钮
    document.querySelectorAll('.delete-completed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseFloat((e.currentTarget as HTMLElement).dataset.id || '0');
        if (confirm('确定要从工作总结中删除此任务吗？')) {
          todoApp.deleteCompletedTodo(id);
          renderSummaryPageView(); // 刷新当前页面
        }
      });
    });
    
    // 导出按钮
    const exportBtn = document.getElementById('export-summary-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        exportSummaryToExcel();
      });
    }
  }

  // 导出工作总结到Excel
  function exportSummaryToExcel() {
    const summaryTodos = todoApp.getCompletedTodos();
    const projects = todoApp.getProjects();
    
    // 按项目分组
    const groupedByProject: Map<number | null, Todo[]> = new Map();
    summaryTodos.forEach(todo => {
      const projectId = todo.projectId;
      if (!groupedByProject.has(projectId)) {
        groupedByProject.set(projectId, []);
      }
      groupedByProject.get(projectId)!.push(todo);
    });
    
    // 构建CSV内容（使用UTF-8 BOM确保中文正确显示）
    let csvContent = '\uFEFF';
    
    // 添加标题行
    csvContent += '项目名称,任务内容,创建日期,完成日期,耗时天数,优先级\n';
    
    // 按项目添加数据
    groupedByProject.forEach((todos, projectId) => {
      const project = projectId ? projects.find(p => isIdEqual(p.id, projectId)) : null;
      const projectName = project?.name || '未分类';
      
      todos.forEach(todo => {
        const createdDate = todo.createdAt ? todo.createdAt.split('T')[0] : '未知';
        const completedDate = todo.completedAt ? todo.completedAt.split('T')[0] : '未知';
        const days = todo.createdAt && todo.completedAt 
          ? calculateDaysBetween(createdDate, completedDate)
          : 0;
        const priorityMap: Record<string, string> = {
          'high': '高',
          'medium': '中',
          'low': '低'
        };
        const priority = priorityMap[todo.priority] || '中';
        
        // 转义CSV字段（处理逗号和引号）
        const escapeCsv = (field: string) => {
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return '"' + field.replace(/"/g, '""') + '"';
          }
          return field;
        };
        
        csvContent += `${escapeCsv(projectName)},${escapeCsv(todo.text)},${createdDate},${completedDate},${days},${priority}\n`;
      });
    });
    
    // 创建下载链接
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `工作总结_${getLocalDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // 回收站模态框事件监听
  function attachTrashModalListeners() {
    const modal = document.getElementById('trash-modal');
    const closeBtn = document.getElementById('close-trash-btn');
    const clearBtn = document.getElementById('clear-trash-btn');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
        render(); // 关闭时刷新主页面
      });
    }

    if (clearBtn && modal) {
      clearBtn.addEventListener('click', async () => {
        if (confirm('确定要清空回收站吗？所有任务将被永久删除！')) {
          // 如果是云端模式，确保所有任务的墓碑记录都存在
          if (todoApp.isCloudMode()) {
            try {
              const { dataService } = await import('./storage/database/data-service');
              const userId = todoApp.getCloudUserId();
              
              // 获取当前墓碑记录
              const cloudDeletedTodos = await dataService.deletedTodos.getDeletedTodos(userId);
              const cloudDeletedUniqueIds = new Set(cloudDeletedTodos.map(t => t.unique_id));
              
              // 确保所有本地回收站任务都有墓碑记录
              const localDeletedTodos = todoApp.getDeletedTodos();
              for (const todo of localDeletedTodos) {
                if (todo.uniqueId && !cloudDeletedUniqueIds.has(todo.uniqueId)) {
                  await dataService.deletedTodos.createDeletedTodo(userId, {
                    unique_id: todo.uniqueId,
                  });
                  console.log('已创建墓碑记录:', todo.text);
                }
              }
              console.log('云端墓碑记录已更新');
            } catch (err) {
              console.error('更新云端墓碑记录失败:', err);
            }
          }
          
          // 清空本地回收站（但不删除云端墓碑，防止任务再次同步回来）
          todoApp.clearTrash();
          
          modal.remove();
          render();
        }
      });
    }

    // 恢复按钮
    document.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseFloat((e.currentTarget as HTMLElement).dataset.id || '0');
        const uniqueId = (e.currentTarget as HTMLElement).dataset.todoUniqueId || '';
        const todoText = (e.currentTarget as HTMLElement).dataset.todoText || '';
        
        await restoreTodoWithSync(id, uniqueId, todoText);
        if (modal) {
          modal.remove();
        }
        render();
      });
    });

    // 永久删除按钮
    document.querySelectorAll('.permanent-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseFloat((e.currentTarget as HTMLElement).dataset.id || '0');
        const uniqueId = (e.currentTarget as HTMLElement).dataset.todoUniqueId || '';
        const todoText = (e.currentTarget as HTMLElement).dataset.todoText || '';
        
        if (confirm(`确定要彻底删除任务"${todoText}"吗？\n\n此操作不可恢复！`)) {
          await permanentDeleteTodoWithSync(id, uniqueId, todoText);
          if (modal) {
            modal.remove();
          }
          render(); // 统一调用 render 刷新页面
        }
      });
    });

    // 点击遮罩层关闭
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          render(); // 关闭时刷新主页面
        }
      });
    }
  }

  // 设置模态框事件监听
  function attachSettingsModalListeners() {
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-settings-btn');
    const confirmBtn = document.getElementById('confirm-password-btn');
    const oldPassword = document.getElementById('old-password') as HTMLInputElement;
    const newPassword = document.getElementById('new-password') as HTMLInputElement;
    const confirmPassword = document.getElementById('confirm-password') as HTMLInputElement;
    const themeOptions = document.querySelectorAll('.theme-option');
    const clearLocalBtn = document.getElementById('clear-local-data-btn');
    const clearAllBtn = document.getElementById('clear-all-data-btn');

    // 关闭按钮
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
    }

    // 主题切换
    themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        const theme = (option as HTMLElement).dataset.theme;
        if (theme) {
          todoApp.setTheme(theme as 'minimal' | 'cute' | 'business');
          // 更新选中状态
          themeOptions.forEach(opt => opt.classList.remove('active'));
          option.classList.add('active');
          render(); // 刷新主页面
        }
      });
    });

    // 修改密码
    if (confirmBtn && modal && oldPassword && newPassword && confirmPassword) {
      confirmBtn.addEventListener('click', () => {
        if (newPassword.value !== confirmPassword.value) {
          alert('两次输入的新密码不一致！');
          return;
        }

        if (todoApp.changePassword(oldPassword.value, newPassword.value)) {
          alert('密码修改成功！');
          oldPassword.value = '';
          newPassword.value = '';
          confirmPassword.value = '';
        } else {
          alert('原密码错误！');
        }
      });
    }

    // 清除本地数据
    if (clearLocalBtn && modal) {
      clearLocalBtn.addEventListener('click', async () => {
        if (!confirm('确定要清除本地数据吗？清除后需要重新登录。')) return;
        
        // 清除本地存储
        localStorage.removeItem('todo_todos');
        localStorage.removeItem('todo_projects');
        localStorage.removeItem('todo_deleted_todos');
        localStorage.removeItem('todo_completed_todos');
        localStorage.removeItem('todo_collapsed');
        localStorage.removeItem('todo_deleted_project_names');
        localStorage.removeItem('cloud_session');
        localStorage.removeItem('cloud_user');
        
        alert('本地数据已清除，即将刷新页面。');
        location.reload();
      });
    }

    // 清除本地和云端数据
    if (clearAllBtn && modal) {
      clearAllBtn.addEventListener('click', async () => {
        if (!confirm('确定要清除本地和云端所有数据吗？此操作不可恢复！')) return;
        if (!confirm('再次确认：所有数据将被永久删除！')) return;
        
        try {
          // 清除云端数据
          const userId = todoApp.getCloudUserId();
          if (userId) {
            const { dataService } = await import('./storage/database/data-service');
            
            // 获取所有数据并删除
            const projects = await dataService.projects.getProjects(userId);
            const todos = await dataService.todos.getTodos(userId);
            const completed = await dataService.completedTodos.getCompletedTodos(userId);
            const deleted = await dataService.deletedTodos.getDeletedTodos(userId);
            
            // 删除任务
            for (const t of todos) await dataService.todos.deleteTodo(t.id);
            // 删除项目
            for (const p of projects) await dataService.projects.deleteProject(p.id);
            // 删除已删除任务
            for (const d of deleted) await dataService.deletedTodos.deleteDeletedTodo(d.id);
            // 已完成任务需要用 supabase 直接删除
            const { getSupabaseClient } = await import('./storage/database/supabase-client');
            const client = getSupabaseClient();
            await client.from('completed_todos').delete().eq('user_id', userId);
          }
          
          // 清除本地存储
          localStorage.clear();
          
          alert('所有数据已清除，即将刷新页面。');
          location.reload();
        } catch (e) {
          console.error('清除数据失败:', e);
          alert('清除数据失败，请重试。');
        }
      });
    }

    // 点击遮罩层关闭
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    }
  }

  // 更新项目列表（不关闭弹窗）
  function updateProjectList() {
    const projectListEl = document.getElementById('project-list');
    if (!projectListEl) return;
    
    const projects = todoApp.getProjects();
    
    if (projects.length === 0) {
      projectListEl.innerHTML = `
        <div class="empty-project-tip">
          ${getIcon('folder')}
          <p>暂无项目</p>
          <p class="empty-hint">在上方创建您的第一个项目</p>
        </div>
      `;
    } else {
      projectListEl.innerHTML = projects.map(p => {
        const priorityConf = projectPriorityConfig[p.priority || 'medium'];
        return `
          <div class="project-item" data-id="${p.id}">
            <div class="project-item-row">
              <span class="project-color" style="background: ${p.color};"></span>
              <span class="project-name-text">${p.name}</span>
              <span class="project-priority-badge" style="background: ${priorityConf.bg}; color: ${priorityConf.color};">${priorityConf.label}</span>
              <button class="rename-project-btn" data-id="${p.id}" title="编辑">${getIcon('edit')}</button>
              <button class="delete-project-btn" data-id="${p.id}" title="删除">${getIcon('trash')}</button>
            </div>
            <div class="project-item-details">
              <div class="detail-item">
                <span class="detail-label">📅 开始日期</span>
                <span class="detail-value">${p.startDate || '未设置'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">🎯 计划完成</span>
                <span class="detail-value">${p.endDate || '未设置'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">📊 当前进度</span>
                <span class="detail-value ${p.progress ? 'has-progress' : ''}">${p.progress || '未设置'}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
    
    // 使用事件委托处理点击和触摸（更可靠，不受DOM更新影响）
    // 使用 addEventListener 而不是直接赋值，确保事件能正确触发
    projectListEl.removeEventListener('click', handleProjectItemClick);
    projectListEl.removeEventListener('touchend', handleProjectItemClick);
    projectListEl.removeEventListener('pointerup', handleProjectItemClick);
    
    projectListEl.addEventListener('click', handleProjectItemClick);
    projectListEl.addEventListener('touchend', handleProjectItemClick, { passive: false });
    projectListEl.addEventListener('pointerup', handleProjectItemClick);
  }
  
  // 项目列表事件委托处理
  function handleProjectItemClick(e: Event) {
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest('.delete-project-btn');
    const editBtn = target.closest('.rename-project-btn');
    
    // 调试日志
    const currentProjects = todoApp.getProjects();
    console.log('项目列表事件触发:', e.type);
    console.log('当前项目列表:', currentProjects.map(p => ({ id: p.id, name: p.name })));
    
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const idStr = deleteBtn.getAttribute('data-id');
      console.log('删除按钮点击, data-id:', idStr);
      if (!idStr) {
        alert('无法获取项目ID');
        return;
      }
      const id = parseFloat(idStr);
      console.log('解析后的ID:', id, '类型:', typeof id);
      
      // 先尝试通过ID查找，如果找不到则尝试通过名称查找
      let project = currentProjects.find(p => isIdEqual(p.id, id));
      
      if (!project) {
        // 尝试从按钮所在的父元素获取项目名称
        const projectItem = deleteBtn.closest('.project-item');
        const nameEl = projectItem?.querySelector('.project-name-text');
        if (nameEl) {
          const name = nameEl.textContent || '';
          project = currentProjects.find(p => p.name === name);
          console.log('通过名称查找项目:', name, '结果:', project);
        }
      }
      
      console.log('找到的项目:', project);
      
      if (!project) {
        // 项目不存在，可能是数据已更新，刷新项目列表
        updateProjectList();
        alert('项目数据已更新，请重试');
        return;
      }
      
      if (window.confirm('确认删除？该项目下的所有待办将移至回收站')) {
        deleteProjectWithSync(project.id, project);
      }
      return;
    }
    
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      const idStr = editBtn.getAttribute('data-id');
      console.log('编辑按钮点击, data-id:', idStr);
      if (!idStr) {
        alert('无法获取项目ID');
        return;
      }
      const id = parseFloat(idStr);
      
      // 先尝试通过ID查找，如果找不到则尝试通过名称查找
      let project = currentProjects.find(p => isIdEqual(p.id, id));
      
      if (!project) {
        // 尝试从按钮所在的父元素获取项目名称
        const projectItem = editBtn.closest('.project-item');
        const nameEl = projectItem?.querySelector('.project-name-text');
        if (nameEl) {
          const name = nameEl.textContent || '';
          project = currentProjects.find(p => p.name === name);
          console.log('通过名称查找项目:', name, '结果:', project);
        }
      }
      
      console.log('找到的项目:', project);
      
      if (!project) {
        // 项目不存在，可能是数据已更新，刷新项目列表
        updateProjectList();
        alert('项目数据已更新，请重试');
        return;
      }
      
      showEditProjectModal(project);
      return;
    }
  }

  // 删除项目并同步到云端
  async function deleteProjectWithSync(id: number, project: any) {
    // 如果是云端模式，先从云端删除
    if (todoApp.isCloudMode() && project) {
      try {
        const { dataService } = await import('./storage/database/data-service');
        const userId = todoApp.getCloudUserId();
        
        // 优先使用 uniqueId 匹配云端项目
        let cloudProject = null;
        if (project.uniqueId) {
          const cloudProjects = await dataService.projects.getProjects(userId);
          cloudProject = cloudProjects.find(p => p.unique_id === project.uniqueId);
        }
        
        // 如果没有 uniqueId 或找不到，再通过名称匹配
        if (!cloudProject && project.name) {
          const cloudProjects = await dataService.projects.getProjects(userId);
          cloudProject = cloudProjects.find(p => p.name === project.name);
        }
        
        if (cloudProject) {
          // 先记录墓碑记录（防止同步时重新上传）
          const projectUniqueId = project.uniqueId || cloudProject.unique_id;
          if (projectUniqueId) {
            await dataService.deletedTodos.createDeletedTodo(userId, {
              unique_id: projectUniqueId,
              text: `[PROJECT] ${project.name}`,
              completed: false,
              priority: 'medium',
            });
            console.log('已记录项目墓碑:', project.name);
          }
          
          // 再删除云端项目
          await dataService.projects.deleteProject(cloudProject.id);
          console.log('已从云端删除项目:', project.name);
        }
      } catch (err) {
        console.error('云端删除项目失败:', err);
        // 云端删除失败，但仍继续本地删除（离线模式）
        alert('云端同步失败，已从本地删除: ' + (err as Error).message);
      }
    }
    
    // 无论如何都执行本地删除
    todoApp.deleteProject(id);
    updateProjectList();
  }

  // 从主界面删除任务并同步到云端
  async function deleteTodoFromMainWithSync(todoId: number, uniqueId: string, todoText: string) {
    // 如果是云端模式，先记录墓碑再删除云端
    if (todoApp.isCloudMode() && uniqueId) {
      try {
        const { dataService } = await import('./storage/database/data-service');
        const userId = todoApp.getCloudUserId();
        
        // 1. 先记录墓碑（防止同步时重新上传）
        await dataService.deletedTodos.createDeletedTodo(userId, {
          unique_id: uniqueId,
        });
        console.log('已记录任务墓碑:', todoText);
        
        // 2. 删除云端任务
        const cloudTodos = await dataService.todos.getTodos(userId);
        const cloudTodo = cloudTodos.find(t => t.unique_id === uniqueId);
        
        if (cloudTodo) {
          await dataService.todos.deleteTodo(cloudTodo.id);
          console.log('已从云端删除任务:', todoText);
        }
        
      } catch (err) {
        console.error('云端删除任务失败:', err);
        // 云端删除失败，但仍继续本地删除
        alert('云端同步失败，已从本地删除: ' + (err as Error).message);
      }
    }
    
    // 本地删除（移入回收站）
    todoApp.deleteTodo(todoId);
  }

  // 删除任务并同步到云端（项目一览页面使用）
  async function deleteTodoWithSync(todoId: number | null, uniqueId: string, isCompleted: boolean, todoText: string) {
    // 如果是云端模式，先记录墓碑再删除
    if (todoApp.isCloudMode()) {
      try {
        const { dataService } = await import('./storage/database/data-service');
        const userId = todoApp.getCloudUserId();
        
        // 1. 先记录墓碑（防止同步时重新上传）
        await dataService.deletedTodos.createDeletedTodo(userId, {
          unique_id: uniqueId,
        });
        console.log('已记录任务墓碑:', todoText);
        
        // 2. 删除云端任务
        if (isCompleted) {
          // 已完成任务 - 从 completed_todos 表删除
          const cloudCompletedTodos = await dataService.completedTodos.getCompletedTodos(userId);
          const cloudTodo = cloudCompletedTodos.find(t => t.unique_id === uniqueId);
          
          if (cloudTodo) {
            await dataService.completedTodos.deleteCompletedTodo(cloudTodo.id);
            console.log('已从云端删除已完成任务:', todoText);
          }
        } else {
          // 未完成任务 - 从 todos 表删除
          const cloudTodos = await dataService.todos.getTodos(userId);
          const cloudTodo = cloudTodos.find(t => t.unique_id === uniqueId);
          
          if (cloudTodo) {
            await dataService.todos.deleteTodo(cloudTodo.id);
            console.log('已从云端删除待完成任务:', todoText);
          }
        }
        
      } catch (err) {
        console.error('云端删除任务失败:', err);
        alert('云端同步失败，已从本地删除: ' + (err as Error).message);
      }
    }
    
    // 本地删除
    if (isCompleted) {
      // 已完成任务 - 通过 uniqueId 找到 id，调用 deleteCompletedTodo
      const completedTodos = todoApp.getCompletedTodos();
      const todo = completedTodos.find(t => t.uniqueId === uniqueId);
      if (todo && todo.id) {
        todoApp.deleteCompletedTodo(todo.id);
      }
    } else if (todoId !== null) {
      // 未完成任务调用标准删除方法（会移入回收站）
      todoApp.deleteTodo(todoId);
    }
  }

  // 从回收站永久删除任务并同步到云端
  // 注意：保留墓碑记录，防止任务从其他设备同步回来
  async function permanentDeleteTodoWithSync(todoId: number, uniqueId: string, todoText: string) {
    // 如果是云端模式，确保云端数据已删除，但保留墓碑记录
    if (todoApp.isCloudMode() && uniqueId) {
      try {
        const { dataService } = await import('./storage/database/data-service');
        const userId = todoApp.getCloudUserId();
        
        // 1. 确保云端墓碑记录存在（如果没有则创建）
        const cloudDeletedTodos = await dataService.deletedTodos.getDeletedTodos(userId);
        const cloudDeletedTodo = cloudDeletedTodos.find(t => t.unique_id === uniqueId);
        
        if (!cloudDeletedTodo) {
          // 如果墓碑不存在，创建一个
          await dataService.deletedTodos.createDeletedTodo(userId, {
            unique_id: uniqueId,
          });
          console.log('已创建任务墓碑:', todoText);
        }
        
        // 2. 确保云端原始数据已删除（双重保险）
        // 检查 todos 表
        const cloudTodos = await dataService.todos.getTodos(userId);
        const cloudTodo = cloudTodos.find(t => t.unique_id === uniqueId);
        if (cloudTodo) {
          await dataService.todos.deleteTodo(cloudTodo.id);
          console.log('清理云端残留任务:', todoText);
        }
        
        // 检查 completed_todos 表
        const cloudCompletedTodos = await dataService.completedTodos.getCompletedTodos(userId);
        const cloudCompletedTodo = cloudCompletedTodos.find(t => t.unique_id === uniqueId);
        if (cloudCompletedTodo) {
          await dataService.completedTodos.deleteCompletedTodo(cloudCompletedTodo.id);
          console.log('清理云端残留已完成任务:', todoText);
        }
        
        console.log('已彻底删除任务，保留墓碑:', todoText);
        
      } catch (err) {
        console.error('云端彻底删除任务失败:', err);
        alert('云端同步失败，已从本地删除: ' + (err as Error).message);
      }
    }
    
    // 本地永久删除
    todoApp.permanentDeleteTodo(todoId);
  }

  // 从回收站恢复任务并同步到云端
  async function restoreTodoWithSync(todoId: number, uniqueId: string, todoText: string) {
    // 如果是云端模式，需要删除墓碑记录
    if (todoApp.isCloudMode() && uniqueId) {
      try {
        const { dataService } = await import('./storage/database/data-service');
        const userId = todoApp.getCloudUserId();
        
        // 1. 删除云端墓碑记录（关键：允许任务重新同步）
        const cloudDeletedTodos = await dataService.deletedTodos.getDeletedTodos(userId);
        const cloudDeletedTodo = cloudDeletedTodos.find(t => t.unique_id === uniqueId);
        
        if (cloudDeletedTodo) {
          await dataService.deletedTodos.deleteDeletedTodo(cloudDeletedTodo.id);
          console.log('已删除云端墓碑记录:', todoText);
        }
        
        // 2. 获取任务的完整信息，准备恢复到云端
        const localDeletedTodos = todoApp.getDeletedTodos();
        const todo = localDeletedTodos.find(t => t.uniqueId === uniqueId);
        
        if (todo) {
          // 3. 恢复到云端 todos 表
          await dataService.todos.createTodo(userId, {
            unique_id: todo.uniqueId,
            text: todo.text,
            completed: false,
            priority: todo.priority,
            progress: todo.progress || null,
            end_date: todo.endDate || null,
            completed_at: null,
            project_id: null, // 恢复后暂无项目
          });
          console.log('已恢复任务到云端:', todoText);
        }
        
      } catch (err) {
        console.error('云端恢复任务失败:', err);
        alert('云端同步失败，已从本地恢复: ' + (err as Error).message);
      }
    }
    
    // 本地恢复（无论如何都执行）
    todoApp.restoreTodo(todoId);
  }

  // 显示编辑项目模态框
  function showEditProjectModal(project: Project) {
    const modalHtml = `
      <div class="modal-overlay" id="edit-project-modal">
        <div class="modal-content edit-project-modal-content">
          <div class="modal-header">
            <h3>编辑项目</h3>
            <button class="modal-close-btn" id="cancel-edit-project-btn">${getIcon('x')}</button>
          </div>
          <div class="edit-form-row">
            <div class="edit-form-group">
              <label class="modal-label">项目名称</label>
              <input type="text" id="edit-project-name" value="${project.name}" class="modal-input" placeholder="项目名称" />
            </div>
            <div class="edit-form-group">
              <label class="modal-label">项目颜色</label>
              <input type="color" id="edit-project-color" value="${project.color}" class="color-picker" title="选择颜色" />
            </div>
          </div>
          <div class="edit-form-row">
            <div class="edit-form-group">
              <label class="modal-label">项目优先级</label>
              <select id="edit-project-priority" class="modal-input">
                <option value="high" ${project.priority === 'high' ? 'selected' : ''}>🔴 高优先级</option>
                <option value="medium" ${project.priority === 'medium' ? 'selected' : ''}>🟡 中优先级</option>
                <option value="low" ${project.priority === 'low' ? 'selected' : ''}>🟢 低优先级</option>
              </select>
            </div>
          </div>
          <div class="edit-form-row">
            <div class="edit-form-group">
              <label class="modal-label">开始日期</label>
              <input type="date" id="edit-project-start-date" value="${project.startDate || getLocalDateString()}" class="modal-input" />
            </div>
            <div class="edit-form-group">
              <label class="modal-label">计划完成日期</label>
              <input type="date" id="edit-project-end-date" value="${project.endDate || ''}" class="modal-input" />
            </div>
          </div>
          <div class="edit-form-row">
            <div class="edit-form-group" style="flex: 1;">
              <label class="modal-label">当前进度</label>
              <input type="text" id="edit-project-progress" value="${project.progress || ''}" class="modal-input" placeholder="例如：已完成50%、等待审批中..." />
            </div>
          </div>
          <div class="edit-form-row">
            <div class="edit-form-group" style="flex: 1;">
              <label class="modal-label checkbox-label">
                <input type="checkbox" id="edit-project-completed" ${project.completed ? 'checked' : ''} />
                <span>已完结（隐藏该项目）</span>
              </label>
            </div>
          </div>
          <div class="modal-actions">
            <button id="save-edit-project-btn" data-id="${project.id}" class="modal-btn confirm full-width">保存修改</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('edit-project-modal');
    const cancelBtn = document.getElementById('cancel-edit-project-btn');
    const saveBtn = document.getElementById('save-edit-project-btn');
    const nameInput = document.getElementById('edit-project-name') as HTMLInputElement;
    const colorInput = document.getElementById('edit-project-color') as HTMLInputElement;
    const priorityInput = document.getElementById('edit-project-priority') as HTMLSelectElement;
    const startDateInput = document.getElementById('edit-project-start-date') as HTMLInputElement;
    const endDateInput = document.getElementById('edit-project-end-date') as HTMLInputElement;
    const progressInput = document.getElementById('edit-project-progress') as HTMLInputElement;
    const completedInput = document.getElementById('edit-project-completed') as HTMLInputElement;

    if (cancelBtn && modal) {
      cancelBtn.addEventListener('click', () => {
        modal.remove();
      });
    }

    if (saveBtn && modal && nameInput) {
      saveBtn.addEventListener('click', () => {
        const id = parseFloat((saveBtn as HTMLElement).dataset.id || '0');
        const name = nameInput.value.trim();
        
        if (!name) {
          alert('项目名称不能为空！');
          return;
        }

        // 检查项目名称是否与其他项目重复
        const existingProject = todoApp.getProjects().find(p => p.name === name && p.id !== id);
        if (existingProject) {
          alert('项目名称已存在，请使用不同的名称');
          return;
        }

        todoApp.updateProject(id, {
          name,
          color: colorInput?.value || project.color,
          priority: (priorityInput?.value || 'medium') as 'high' | 'medium' | 'low',
          startDate: startDateInput?.value || null,
          endDate: endDateInput?.value || null,
          progress: progressInput?.value.trim() || '',
          completed: completedInput?.checked || false,
        });

        modal.remove();
        updateProjectList();
        render();
      });
    }

    // 点击遮罩层关闭
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    }
  }

  // 项目管理模态框事件监听
  function attachProjectModalListeners() {
    const modal = document.getElementById('project-modal');
    const closeBtn = document.getElementById('close-project-modal-btn');
    const closeHeaderBtn = document.getElementById('close-project-modal-header-btn');
    const addBtn = document.getElementById('add-project-btn');
    const nameInput = document.getElementById('new-project-name') as HTMLInputElement;
    const colorInput = document.getElementById('new-project-color') as HTMLInputElement;
    const priorityInput = document.getElementById('new-project-priority') as HTMLSelectElement;
    const startDateInput = document.getElementById('new-project-start-date') as HTMLInputElement;
    const endDateInput = document.getElementById('new-project-end-date') as HTMLInputElement;
    const progressInput = document.getElementById('new-project-progress') as HTMLInputElement;

    // 动态设置开始日期为当前日期
    if (startDateInput) {
      startDateInput.value = getLocalDateString();
    }

    // 动态设置颜色选择器为下一个可用颜色
    if (colorInput) {
      colorInput.value = todoApp.getNextAvailableColor();
    }

    // 关闭模态框的函数
    const closeModal = () => {
      if (modal) {
        modal.remove();
        render();
      }
    };

    // 头部关闭按钮
    if (closeHeaderBtn) {
      closeHeaderBtn.addEventListener('click', closeModal);
    }

    // 底部关闭按钮（如果存在）
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    // 点击遮罩关闭
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal();
        }
      });
    }

    // 创建项目
    if (addBtn && nameInput && colorInput) {
      const doAddProject = () => {
        const name = nameInput.value.trim();
        const priority = (priorityInput?.value || 'medium') as 'high' | 'medium' | 'low';
        const today = getLocalDateString();
        const startDate = startDateInput?.value || today;
        const endDate = endDateInput?.value || null;
        const progress = progressInput?.value.trim() || '';
        
        if (name) {
          // 检查项目名称是否已存在
          const existingProject = todoApp.getProjects().find(p => p.name === name);
          if (existingProject) {
            alert('项目名称已存在，请使用不同的名称');
            return;
          }
          
          // 不传递颜色参数，让系统自动生成不重复的颜色
          todoApp.addProject(name, undefined, priority, startDate, endDate, progress);
          
          // 重置表单
          nameInput.value = '';
          if (priorityInput) priorityInput.value = 'medium';
          if (startDateInput) startDateInput.value = today;
          if (endDateInput) endDateInput.value = '';
          if (progressInput) progressInput.value = '';
          
          // 更新颜色选择器显示下一个可用颜色
          colorInput.value = todoApp.getNextAvailableColor();
          
          updateProjectList();
          nameInput.focus();
        } else {
          alert('请输入项目名称');
        }
      };
      
      addBtn.addEventListener('click', doAddProject);
      
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          doAddProject();
        }
      });
    }

    // 使用事件委托处理项目列表的点击和触摸（更可靠，不受DOM更新影响）
    const projectListEl = document.getElementById('project-list');
    if (projectListEl) {
      // 先移除旧的事件监听器
      projectListEl.removeEventListener('click', handleProjectItemClick);
      projectListEl.removeEventListener('touchend', handleProjectItemClick);
      projectListEl.removeEventListener('pointerup', handleProjectItemClick);
      
      // 添加新的事件监听器
      projectListEl.addEventListener('click', handleProjectItemClick);
      projectListEl.addEventListener('touchend', handleProjectItemClick, { passive: false });
      projectListEl.addEventListener('pointerup', handleProjectItemClick);
    }
  }

  // 快速添加任务模态框事件监听
  function attachQuickAddModalListeners(projectId: number | null) {
    const modal = document.getElementById('quick-add-modal');
    const cancelBtn = document.getElementById('cancel-quick-add-btn');
    const confirmBtn = document.getElementById('confirm-quick-add-btn');
    const textInput = document.getElementById('quick-todo-input') as HTMLInputElement;
    const prioritySelect = document.getElementById('quick-priority-select') as HTMLSelectElement;
    const plannedEndDateInput = document.getElementById('quick-planned-end-date-input') as HTMLInputElement;

    // 自动聚焦输入框
    if (textInput) {
      textInput.focus();
    }

    if (cancelBtn && modal) {
      cancelBtn.addEventListener('click', () => {
        modal.remove();
        render();
      });
    }

    const addTodo = () => {
      const text = textInput?.value.trim();
      const plannedEndDate = plannedEndDateInput?.value || null;
      const priority = (prioritySelect?.value || 'medium') as 'high' | 'medium' | 'low';
      
      if (!text) {
        alert('任务内容不能为空！');
        return;
      }
      
      todoApp.addTodo(text, projectId, plannedEndDate, priority);
      if (modal) {
        modal.remove();
      }
      render();
    };

    if (confirmBtn) {
      confirmBtn.addEventListener('click', addTodo);
    }

    // 回车键添加
    if (textInput) {
      textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addTodo();
        }
      });
    }

    // 点击遮罩层关闭
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          render();
        }
      });
    }
  }

  // 编辑待办模态框事件监听
  function attachEditTodoModalListeners() {
    const modal = document.getElementById('edit-todo-modal');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const saveBtn = document.getElementById('save-edit-btn');
    const textInput = document.getElementById('edit-todo-text') as HTMLInputElement;
    const projectSelect = document.getElementById('edit-project-select') as HTMLSelectElement;
    const prioritySelect = document.getElementById('edit-priority-select') as HTMLSelectElement;
    const progressInput = document.getElementById('edit-progress-input') as HTMLInputElement;
    const plannedEndDateInput = document.getElementById('edit-planned-end-date-input') as HTMLInputElement;
    const startDateInput = document.getElementById('edit-start-date') as HTMLInputElement;

    if (cancelBtn && modal) {
      cancelBtn.addEventListener('click', () => {
        modal.remove();
        render();
      });
    }

    if (saveBtn && modal && textInput) {
      saveBtn.addEventListener('click', () => {
        const id = parseFloat((saveBtn as HTMLElement).dataset.id || '0');
        const text = textInput.value.trim();
        
        if (!text) {
          alert('任务内容不能为空！');
          return;
        }

        const projectValue = projectSelect?.value;
        const projectId = (projectValue && projectValue !== 'uncategorized') ? parseFloat(projectValue) : null;
        
        const priority = (prioritySelect?.value || 'medium') as 'high' | 'medium' | 'low';
        const progress = progressInput?.value.trim() || '';
        const plannedEndDate = plannedEndDateInput?.value || null;
        const startDate = startDateInput?.value || null;

        todoApp.updateTodo(id, {
          text,
          projectId,
          priority,
          progress,
          endDate: plannedEndDate,
          startDate,
        });

        modal.remove();
        render();
      });
    }

    // 点击遮罩层关闭
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          render();
        }
      });
    }
  }

  // 初始渲染
  render();
}
