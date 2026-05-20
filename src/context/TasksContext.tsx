import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ContactTag {
  id: string;
  name: string;
  role?: string;
  companyId: string;
  companyName: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  content: string;
  author: string | null;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  prospect_id: string | null;
  prospect_name: string | null;
  order_id: string | null;
  order_name: string | null;
  contact_tags: ContactTag[];
  labels: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TasksContextType {
  tasks: Task[];
  isLoading: boolean;
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<Task | null>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getTaskById: (id: string) => Task | undefined;
  getComments: (taskId: string) => Promise<TaskComment[]>;
  addComment: (taskId: string, content: string, author: string) => Promise<TaskComment | null>;
  updateComment: (commentId: string, content: string) => Promise<TaskComment | null>;
  deleteComment: (commentId: string) => Promise<void>;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

const mapRow = (row: any): Task => ({
  id: row.id,
  title: row.title,
  description: row.description ?? null,
  status: (row.status as TaskStatus) || 'todo',
  priority: (row.priority as TaskPriority) || 'medium',
  due_date: row.due_date ?? null,
  prospect_id: row.prospect_id ?? null,
  prospect_name: row.prospect_name ?? null,
  order_id: row.order_id ?? null,
  order_name: row.order_name ?? null,
  contact_tags: (row.contact_tags as unknown as ContactTag[]) || [],
  labels: (row.labels as unknown as string[]) || [],
  created_by: row.created_by ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapCommentRow = (row: any): TaskComment => ({
  id: row.id,
  task_id: row.task_id,
  content: row.content,
  author: row.author ?? null,
  edited: row.edited ?? false,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const TasksProvider = ({ children }: { children: ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setTasks((data || []).map(mapRow));
      } catch (err) {
        console.error('Failed to load tasks:', err);
        toast({ title: 'Error', description: 'Failed to load tasks.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task | null> => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.due_date,
          prospect_id: taskData.prospect_id,
          prospect_name: taskData.prospect_name,
          order_id: taskData.order_id,
          order_name: taskData.order_name,
          contact_tags: JSON.parse(JSON.stringify(taskData.contact_tags)),
          labels: JSON.parse(JSON.stringify(taskData.labels)),
          created_by: taskData.created_by,
        })
        .select()
        .single();
      if (error) throw error;
      const newTask = mapRow(data);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err) {
      console.error('Failed to add task:', err);
      toast({ title: 'Error', description: 'Failed to create task.', variant: 'destructive' });
      return null;
    }
  };

  const updateTask = async (task: Task): Promise<void> => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          prospect_id: task.prospect_id,
          prospect_name: task.prospect_name,
          order_id: task.order_id,
          order_name: task.order_name,
          contact_tags: JSON.parse(JSON.stringify(task.contact_tags)),
          labels: JSON.parse(JSON.stringify(task.labels)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    } catch (err) {
      console.error('Failed to update task:', err);
      toast({ title: 'Error', description: 'Failed to update task.', variant: 'destructive' });
    }
  };

  const deleteTask = async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
    }
  };

  const getTaskById = (id: string) => tasks.find(t => t.id === id);

  const getComments = async (taskId: string): Promise<TaskComment[]> => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapCommentRow);
    } catch (err) {
      console.error('Failed to load comments:', err);
      return [];
    }
  };

  const addComment = async (taskId: string, content: string, author: string): Promise<TaskComment | null> => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({ task_id: taskId, content, author })
        .select()
        .single();
      if (error) throw error;
      return mapCommentRow(data);
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast({ title: 'Error', description: 'Failed to post comment.', variant: 'destructive' });
      return null;
    }
  };

  const updateComment = async (commentId: string, content: string): Promise<TaskComment | null> => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .update({ content, edited: true, updated_at: new Date().toISOString() })
        .eq('id', commentId)
        .select()
        .single();
      if (error) throw error;
      return mapCommentRow(data);
    } catch (err) {
      console.error('Failed to update comment:', err);
      toast({ title: 'Error', description: 'Failed to update comment.', variant: 'destructive' });
      return null;
    }
  };

  const deleteComment = async (commentId: string): Promise<void> => {
    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', commentId);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete comment:', err);
      toast({ title: 'Error', description: 'Failed to delete comment.', variant: 'destructive' });
    }
  };

  return (
    <TasksContext.Provider value={{
      tasks, isLoading,
      addTask, updateTask, deleteTask, getTaskById,
      getComments, addComment, updateComment, deleteComment,
    }}>
      {children}
    </TasksContext.Provider>
  );
};

export const useTasks = () => {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasks must be used within a TasksProvider');
  return ctx;
};
