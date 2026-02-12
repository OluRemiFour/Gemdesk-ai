// ChatService for MongoDB
// Note: Since we're in an Electron app, we'll use IPC to communicate with the main process
// where MongoDB connection lives

export interface Chat {
  _id: string;
  created_at: Date;
  title: string;
  user_id?: string;
  updated_at?: Date;
}

export interface MessageData {
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  transcription?: string;
  language?: string;
  attachment_url?: string;
  action_json?: any;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const ChatService = {
  // Create a new chat session
  async createChat(title: string = 'New Chat'): Promise<Chat | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (!response.ok) throw new Error('Failed to create chat');
      return await response.json();
    } catch (error) {
      console.error('Error creating chat:', error);
      return null;
    }
  },

  // Get all chats for the user (ordered by recent)
  async getChats(): Promise<Chat[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chats`);
      if (!response.ok) throw new Error('Failed to fetch chats');
      const chats = await response.json();
      return chats.map((chat: any) => ({
        ...chat,
        created_at: new Date(chat.createdAt),
        updated_at: chat.updatedAt ? new Date(chat.updatedAt) : undefined
      }));
    } catch (error) {
      console.error('Error fetching chats:', error);
      return [];
    }
  },

  // Get messages for a specific chat
  async getMessages(chatId: string): Promise<any[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/chats/${chatId}/messages`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const messages = await response.json();
      return messages.map((msg: any) => ({
        ...msg,
        id: msg._id,
        created_at: new Date(msg.createdAt)
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  },

  // Save a message to the database
  async saveMessage(message: MessageData): Promise<any | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: message.chat_id,
          role: message.role,
          content: message.content
        })
      });
      if (!response.ok) throw new Error('Failed to save message');
      return await response.json();
    } catch (error) {
      console.error('Error saving message:', error);
      return null;
    }
  },

  // Update chat title (e.g., after first message)
  async updateChatTitle(chatId: string, title: string) {
    try {
      if (!window.electron?.updateChatTitle) {
        console.error('Electron updateChatTitle not available');
        return;
      }
      await window.electron.updateChatTitle(chatId, title);
    } catch (error) {
      console.error('Error updating chat title:', error);
    }
  },

  // Delete a chat
  async deleteChat(chatId: string) {
    try {
      if (!window.electron?.deleteChat) {
        console.error('Electron deleteChat not available');
        return;
      }
      await window.electron.deleteChat(chatId);
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  }
};
