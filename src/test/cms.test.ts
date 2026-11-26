import { describe,it,expect } from 'vitest';
import { canManage } from '@/lib/cms';
describe('Editor permissions',()=>{
  it('allows administrators to manage content',()=>expect(canManage(['admin'])).toBe(true));
  it('does not grant management to ordinary signed-in accounts',()=>expect(canManage(['user'])).toBe(false));
});