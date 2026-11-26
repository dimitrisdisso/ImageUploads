export function signupOutcome(data: { session: unknown; user: { identities?: unknown[] } | null }) {
  if (data.session) return 'signed-in';
  if (data.user?.identities?.length === 0) return 'existing';
  return 'confirmation';
}

function errorCode(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && error.code) return error.code;
  return 'message' in error ? error.message : undefined;
}

export function authFailure(error: unknown, fallback: string) {
  const code = errorCode(error);
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Έχουν σταλεί πολλά αιτήματα. Περιμένετε λίγο πριν δοκιμάσετε ξανά.';
  if (code === 'pwned_password') return 'Αυτός ο κωδικός έχει εμφανιστεί σε γνωστή διαρροή κωδικών άλλων ιστοτόπων. Επιλέξτε διαφορετικό κωδικό.';
  if (code === 'email_not_confirmed') return 'Επιβεβαιώστε το email σας πριν συνδεθείτε. Μπορείτε να ζητήσετε νέο σύνδεσμο επιβεβαίωσης.';
  if (code === 'invalid_credentials') return 'Το email ή ο κωδικός δεν είναι σωστά. Αν είχατε ήδη εγγραφεί, επιλέξτε «Ξεχάσατε τον κωδικό;» — μια νέα εγγραφή δεν αλλάζει τον παλιό κωδικό.';
  return fallback;
}
