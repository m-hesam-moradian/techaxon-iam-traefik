// src/config/clients.config.ts

import { registerAs } from '@nestjs/config';

export interface RegisteredClient {
  clientId: string;
  clientName: string;
  allowedRedirectUris: string[];
}

export const DEFAULT_CLIENTS: Record<string, RegisteredClient> = {
  'techaxon-lms': {
    clientId: 'techaxon-lms',
    clientName: 'TechAxon LMS',
    allowedRedirectUris: [
      'https://lms.techaxon.de/auth/callback',
      'https://lms.techaxon.localhost/auth/callback',
      'http://localhost:3000/auth/callback',
      'http://localhost:3001/auth/callback',
    ],
  },
  'techaxon-kanban': {
    clientId: 'techaxon-kanban',
    clientName: 'TechAxon Kanban',
    allowedRedirectUris: [
      'https://kanban.techaxon.de/auth/callback',
      'https://kanban.techaxon.localhost/auth/callback',
      'http://localhost:3000/auth/callback',
      'http://localhost:3001/auth/callback',
    ],
  },
  'techaxon-shop': {
    clientId: 'techaxon-shop',
    clientName: 'TechAxon Shop',
    allowedRedirectUris: [
      'https://shop.techaxon.de/auth/callback',
      'https://shop.techaxon.localhost/auth/callback',
      'http://localhost:3000/auth/callback',
      'http://localhost:3001/auth/callback',
    ],
  },
  'test-client': {
    clientId: 'test-client',
    clientName: 'Test Client Application',
    allowedRedirectUris: [
      'https://app.example.com/callback',
      'http://localhost:3000/callback',
      'http://localhost:3001/callback',
      'http://localhost:8080/callback',
    ],
  },
  'techaxon-web': {
    clientId: 'techaxon-web',
    clientName: 'TechAxon Web Portal',
    allowedRedirectUris: [
      'http://localhost:3000/api/auth/callback',
      'https://portal.techaxon.com/api/auth/callback',
      'http://localhost:3001/callback',
    ],
  },
  'techaxon-app': {
    clientId: 'techaxon-app',
    clientName: 'TechAxon App',
    allowedRedirectUris: [
      'http://localhost:3000/callback',
      'http://localhost:3001/callback',
      'https://app.techaxon.com/callback',
    ],
  },
  'client-app': {
    clientId: 'client-app',
    clientName: 'Client Application',
    allowedRedirectUris: ['https://client.example.com/callback', 'http://localhost:3000/callback'],
  },
  'my-client': {
    clientId: 'my-client',
    clientName: 'My Client Application',
    allowedRedirectUris: [
      'https://my-client.example.com/callback',
      'http://localhost:3000/callback',
    ],
  },
};

function loadClientsFromEnv(): Record<string, RegisteredClient> {
  const customClientsEnv = process.env.OIDC_CLIENTS_JSON;
  if (!customClientsEnv) {
    return DEFAULT_CLIENTS;
  }

  try {
    const parsed = JSON.parse(customClientsEnv) as Record<string, RegisteredClient>;
    return {
      ...DEFAULT_CLIENTS,
      ...parsed,
    };
  } catch {
    return DEFAULT_CLIENTS;
  }
}

export default registerAs('clients', () => ({
  clients: loadClientsFromEnv(),
}));
