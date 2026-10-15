import { findUserById } from '../services/user.service';

export function getUser(id: string): string {
  return findUserById(id);
}

