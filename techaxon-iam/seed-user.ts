import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

async function seed() {
  const dbUrl = 'http://admin:secret123@localhost:5984/idp_core';
  
  const email = 'admin@techaxon.com';
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);
  
  const userId = `user:${randomUUID()}`;
  const now = new Date().toISOString();

  const userDoc = {
    _id: userId,
    type: 'user',
    username: 'admin',
    email: email,
    passwordHash: passwordHash,
    status: 'active',
    emailVerified: true,
    tenantId: null,
    createdAt: now,
    updatedAt: now,
  };

  const response = await fetch(dbUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userDoc)
  });

  if (response.ok) {
    console.log(`✅ User seeded successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } else {
    const error = await response.text();
    console.error(`❌ Failed to seed user:`, error);
  }
}

seed().catch(console.error);
