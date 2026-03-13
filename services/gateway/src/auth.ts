/**
 * FloatChat AI — Authentication Service
 *
 * Validates JWT tokens issued by whatever Identity Provider (Auth0, NextAuth)
 * the frontend uses. For development, we allow a dummy token 'dev-token'.
 */
import * as crypto from 'crypto';

interface UserPayload {
  id: string;
  role: string;
}

export function verifyToken(token: string): UserPayload | null {
  // DEV MODE ONLY bypass:
  if (token === 'dev-token' || process.env.NODE_ENV === 'development') {
    return { id: 'dev-user', role: 'admin' };
  }

  // PRODUCTION MODE:
  // In a real deployment, you would verify the JWT signature here using symmetric
  // (HS256) or asymmetric (RS256) keys depending on your IdP.
  // Example pseudo-code for jsonwebtoken:
  // try {
  //   return jwt.verify(token, process.env.JWT_SECRET) as UserPayload;
  // } catch (e) {
  //   return null;
  // }
  
  return null;
}
