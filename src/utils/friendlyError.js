// src/utils/friendlyError.js
export const friendlyError = (error) => {
  const code = error.code || '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'The sign-in popup was closed before completion. Please try again.';
    case 'auth/email-already-in-use':
      return 'This email is already in use. Please try logging in or use a different email.';
    case 'auth/password-does-not-meet-requirements':
      return 'Your password is too weak. It should contain uppercase, lowercase, and non-alphanumeric characters.';
    case 'auth/invalid-credential':
      return 'Invalid credentials provided. Please check your email and password.';
    case 'auth/user-not-found':
      return 'No user found with this email. Please sign up first.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    // more mappings as needed
    default:
      return error.message || 'An unknown error occurred. Please try again.';
  }
};
