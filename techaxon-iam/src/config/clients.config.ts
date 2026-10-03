// src/config/clients.config.ts

import { registerAs } from '@nestjs/config';

export interface RegisteredClient {
  clientId: string;
  clientName: string;
  allowedRedirectUris: string[];
  defaultRedirectUri?: string;
}

export const DEFAULT_CLIENTS: Record<string, RegisteredClient> = {
  'techaxon-lms': {
    clientId: 'techaxon-lms',
    clientName: 'TechAxon LMS',
    defaultRedirectUri: 'https://lms.techaxon.de/auth/callback',
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
    defaultRedirectUri: 'https://kanban.techaxon.de/auth/callback',
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
    defaultRedirectUri: 'https://shop.techaxon.de/auth/callback',
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
    defaultRedirectUri: 'https://app.example.com/callback',
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
    defaultRedirectUri: 'http://localhost:3000/callback',
    allowedRedirectUris: [
      'http://localhost:3000/callback',
      'http://localhost:3001/callback',
      'https://app.techaxon.com/callback',
    ],
  },
  'client-app': {
    clientId: 'client-app',
    clientName: 'Client Application',
    defaultRedirectUri: 'https://client.example.com/callback',
    allowedRedirectUris: ['https://client.example.com/callback', 'http://localhost:3000/callback'],
  },
  'my-client': {
    clientId: 'my-client',
    clientName: 'My Client Application',
    defaultRedirectUri: 'https://my-client.example.com/callback',
    allowedRedirectUris: [
      'https://my-client.example.com/callback',
      'http://localhost:3000/callback',
    ],
  },
};

function loadClientsFromEnv(): Record<string, RegisteredClient> {
  const webRedirectUri =
    process.env.OIDC_WEB_REDIRECT_URI ?? 'http://localhost:3001/callback';
  const defaultClients = {
    ...DEFAULT_CLIENTS,
    'techaxon-web': {
      ...DEFAULT_CLIENTS['techaxon-web'],
      defaultRedirectUri: webRedirectUri,
      allowedRedirectUris: [
        ...DEFAULT_CLIENTS['techaxon-web'].allowedRedirectUris,
        webRedirectUri,
      ],
    },
  };
  const customClientsEnv = process.env.OIDC_CLIENTS_JSON;
  if (!customClientsEnv) {
    return defaultClients;
  }

  try {
    const parsed = JSON.parse(customClientsEnv) as Record<string, RegisteredClient>;
    return {
      ...defaultClients,
      ...parsed,
    };
  } catch (error: unknown) {
    throw new Error('OIDC_CLIENTS_JSON must contain valid JSON', { cause: error });
  }
}

export default registerAs('clients', () => ({
  clients: loadClientsFromEnv(),
}));
