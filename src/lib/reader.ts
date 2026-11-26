import { z } from 'zod';

export const nameSchema = z.string().trim().min(1, 'Συμπληρώστε το όνομά σας.').max(80, 'Το όνομα μπορεί να έχει έως 80 χαρακτήρες.');
export const emailSchema = z.string().trim().email('Συμπληρώστε ένα έγκυρο email.').max(255);
export const passwordSchema = z.string().min(8, 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.').max(128);
export const registrationSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const commentSchema = z.string().trim().min(1, 'Γράψτε το σχόλιό σας.').max(1500, 'Το σχόλιο μπορεί να έχει έως 1500 χαρακτήρες.');
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f]/.test(value)) return '/profile';
  if (value.split(/[?#]/)[0] === '/auth' || value.startsWith('/reset-password')) return '/profile';
  return value;
}
export type ReaderComment = { id: string; user_id: string | null; created_at: string; status: string; name: string; text: string; article: string };
export function canEditComment(comment: Pick<ReaderComment, 'user_id'>, userId: string | undefined) {
  return Boolean(userId && comment.user_id === userId);
}
export function commentFromRow(row: { id: string; user_id: string | null; created_at: string; status: string; data: unknown }): ReaderComment {
  const d = row.data as Record<string, unknown>;
  return { ...row, name: String(d['name'] ?? 'Αναγνώστης'), text: String(d['text'] ?? ''), article: String(d['article'] ?? '') };
}
export const COMMENT_PUBLISHED_STATUS = 'approved' as const;
