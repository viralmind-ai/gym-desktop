import { writable, get } from 'svelte/store';

export const walletAddress = writable<string | null>(null);
export const isConnecting = writable(false);
export const connectionToken = writable<string | null>(null);

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function getConnectionUrl() {
  let token = get(connectionToken);
  if (!token) {
    token = generateToken();
    connectionToken.set(token);
  }
  return `http://localhost/connect?token=${token}`;
}

let currentInterval: number | null = null;

export function startPolling() {
  const token = get(connectionToken);
  if (!token) return;

  // Clear any existing interval
  if (currentInterval) {
    clearInterval(currentInterval);
  }

  isConnecting.set(true);
  
  // Reset "Connecting..." text after 5 seconds
  setTimeout(() => {
    isConnecting.set(false);
  }, 5000);
  
  // Poll for connection status
  currentInterval = setInterval(async () => {
    try {
      const response = await fetch(`http://localhost/api/forge/check-connection?token=${token}`);
      const data = await response.json();
      
      if (data.connected) {
        walletAddress.set(data.address);
        connectionToken.set(null);
        if (currentInterval) {
          clearInterval(currentInterval);
          currentInterval = null;
        }
      }
    } catch (error) {
      console.error('Failed to check connection:', error);
    }
  }, 1000);
}

export function disconnectWallet() {
  walletAddress.set(null);
  connectionToken.set(null);
  if (currentInterval) {
    clearInterval(currentInterval);
    currentInterval = null;
  }
}
