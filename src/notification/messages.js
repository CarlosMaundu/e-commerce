// src/notification/messages.js
//
// Single source of user-facing success / info / warning copy, plus the
// fallbacks shown when an error carries nothing presentable.
// Use with the notifier:  notify.success(MESSAGES.auth.signedIn)
//                         notify.error(err, MESSAGES.product.saveFailed)
//
// Style: short, plain sentences; say what happened and, for errors, what to
// do next. No codes, no "Error:" prefixes, no exclamation marks on errors.

export const MESSAGES = {
  auth: {
    signedIn: 'Welcome back! You’re signed in.',
    signedInGoogle: 'Welcome! You’re signed in with Google.',
    signedOut: 'You’ve been signed out.',
    signedUp: 'Your account has been created. Welcome!',
    signInLinkSent: (email) =>
      `We sent a sign-in link to ${email}. Open it on this device to continue.`,
    signInLinkCompleted: 'You’re signed in. Redirecting…',
    signInLinkConfirmEmail:
      'Please confirm the email address you used to request the link.',
    resetLinkSent: (email) =>
      `If an account exists for ${email}, we’ve sent a password reset link. Check your inbox and spam folder.`,
    passwordReset: 'Your password has been reset. You can now sign in.',
    sessionRequired: 'Please sign in to continue.',
    passwordsDoNotMatch: 'The passwords don’t match.',
    signInFailed: 'We couldn’t sign you in. Please try again.',
    signUpFailed: 'We couldn’t create your account. Please try again.',
    resetFailed: 'We couldn’t reset your password. Please try again.',
    linkFailed: 'We couldn’t send the link. Please try again.',
    profileSyncFailed:
      'You’re signed in, but we couldn’t load your profile. Some features may be unavailable — please refresh the page.',
  },
  profile: {
    updated: 'Your profile has been updated.',
    passwordChanged: 'Your password has been changed.',
    updateFailed: 'We couldn’t update your profile. Please try again.',
    passwordChangeFailed: 'We couldn’t change your password. Please try again.',
    currentPasswordRequired: 'Enter your current password to set a new one.',
    noPasswordAccount:
      'You sign in with Google, so there’s no password to change here.',
    avatarUploaded: 'Profile picture uploaded.',
    avatarUploadFailed:
      'We couldn’t upload that picture. Please try another file.',
  },
  users: {
    created: (email) =>
      `User created. We emailed ${email} a link to set their password.`,
    updated: 'User updated.',
    resetSent: (email) => `Password reset email sent to ${email}.`,
    loadFailed: 'We couldn’t load users. Please refresh to try again.',
    createFailed: 'We couldn’t create the user. Please try again.',
    updateFailed: 'We couldn’t update the user. Please try again.',
    resetFailed: 'We couldn’t send the reset email. Please try again.',
  },
  product: {
    created: 'Product created.',
    updated: 'Product updated.',
    deleted: 'Selected products deleted.',
    draftSaved: 'Draft saved.',
    maxImages: 'You can add up to 6 images.',
    saveFailed: 'We couldn’t save the product. Please try again.',
    deleteFailed: 'We couldn’t delete some products. Please try again.',
    loadFailed: 'We couldn’t load products. Please refresh to try again.',
  },
  category: {
    created: 'Category created.',
    updated: 'Category updated.',
    deleted: 'Selected categories deleted.',
    nameRequired: 'Please enter a category name.',
    imageRequired: 'Please upload a category image.',
    notFound:
      'Some categories no longer exist. We’ve refreshed the list for you.',
    saveFailed: 'We couldn’t save the category. Please try again.',
    deleteFailed: 'We couldn’t delete the categories. Please try again.',
  },
  file: {
    uploaded: 'File uploaded.',
    uploadFailed: 'We couldn’t upload that file. Please try another one.',
  },
  cart: {
    invalidPromo: 'That promo code isn’t valid.',
    promoApplied: 'Promo code applied.',
  },
  checkout: {
    paymentSucceeded: 'Payment successful. Thank you for your order!',
    paymentFailed:
      'Your payment didn’t go through. Please check your card details and try again.',
    paymentsUnavailable:
      'Payments aren’t available right now. Please try again later.',
  },
  newsletter: {
    subscribed: 'You’re subscribed to our newsletter.',
    failed: 'We couldn’t subscribe you right now. Please try again later.',
    unavailable:
      'Newsletter sign-up isn’t available yet. Please check back soon.',
  },
};

export default MESSAGES;
