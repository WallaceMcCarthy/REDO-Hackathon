import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ConvexError } from "convex/values";
import { isValidEmail, normalizeEmail } from "./lib/email";

const password = Password({
  profile(params) {
    const email = normalizeEmail(String(params.email ?? ""));
    if (params.flow === "signUp" && !isValidEmail(email)) throw new ConvexError("Enter a valid email address.");
    return { email };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [password],
});
