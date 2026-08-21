import { BaseDocument } from './base.document';

export interface EmailClaimDocument extends BaseDocument {
  type: 'email_claim';

  email: string;

  userId: string;
}
