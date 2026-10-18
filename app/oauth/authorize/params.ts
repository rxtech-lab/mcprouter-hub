/** Query parameters of the authorization request, carried through sign-in and the consent form. */
export const AUTHORIZE_PARAMS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "state",
  "code_challenge",
  "code_challenge_method",
  "resource",
  "scope",
] as const;
