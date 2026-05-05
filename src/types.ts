export interface HistoryItem {
  id: string;
  text: string;
  imageUrl?: string;
  status: 'success' | 'error';
  timestamp: number;
  errorMessage?: string;
  channelId: string;
}

export interface TelegramConfig {
  botToken: string;
  channelId: string;
}
