export function sendTelegramMessage(
  token: string, 
  chatId: string, 
  text: string, 
  imageFile?: File | Blob | null, 
  onProgress?: (progress: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!token) return reject(new Error("Bot token is required. Please check your configuration."));
    if (!chatId) return reject(new Error("Channel ID is required. Format: @mychannel or -100..."));
    if (!text && !imageFile) return reject(new Error("Message text or image is required."));

    let endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('parse_mode', 'HTML');

    if (imageFile) {
      endpoint = `https://api.telegram.org/bot${token}/sendPhoto`;
      formData.append('photo', imageFile);
      if (text) formData.append('caption', text);
    } else {
      formData.append('text', text);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
          resolve(data);
        } else {
          let friendlyMessage = data.description || "An unknown error occurred.";
          const code = data.error_code || xhr.status;
          
          if (code === 400 && friendlyMessage.includes('chat not found')) {
            friendlyMessage = "Channel not found. Verify Channel ID and ensure bot has admin rights.";
          } else if (code === 401) {
            friendlyMessage = "Unauthorized. Please check if your Bot Token is correct.";
          } else if (code === 403 && friendlyMessage.includes('kicked')) {
            friendlyMessage = "Bot was kicked. Please add it back as an administrator.";
          } else if (code === 403) {
            friendlyMessage = "Forbidden. Ensure the bot has permission to post in this channel.";
          } else if (code === 429) {
            const retryAfter = data.parameters?.retry_after || "a while";
            friendlyMessage = `Too many requests. Wait ${retryAfter} seconds before posting again.`;
          } else if (code === 400 && friendlyMessage.includes("can't parse entities")) {
            friendlyMessage = "Invalid HTML formatting. Please check your HTML tags.";
          }

          reject(new Error(friendlyMessage));
        }
      } catch (e) {
        reject(new Error("Failed to parse response."));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error. Please check your internet connection."));
    };

    xhr.send(formData);
  });
}

