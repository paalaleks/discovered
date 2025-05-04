import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      code
    );

    if (!exchangeError) {
      // Code exchange successful, now get the session to access provider tokens
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        console.error(
          "OAuth callback: Error getting session after code exchange:",
          sessionError
        );
        // Redirect to error page or handle differently
        return NextResponse.redirect(
          `${origin}/auth/error?message=session-fetch-failed`
        );
      }

      const session = sessionData.session;
      console.log(
        "OAuth callback: Session obtained after exchange:",
        JSON.stringify(session, null, 2)
      );

      // Extract provider tokens from the session
      const providerToken = session.provider_token;
      const providerRefreshToken = session.provider_refresh_token;
      const providerExpiresAt = session.expires_at; // Spotify uses expires_at

      if (!providerToken || !providerRefreshToken) {
        console.warn(
          "OAuth callback: Provider tokens not found in session after exchange. Scopes might be missing or login flow issue."
        );
        // Proceed with redirect, but SDK might fail later
      } else {
        console.log(
          "OAuth callback: Provider tokens found, attempting to save to user_metadata."
        );
        // Save tokens to user_metadata
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            provider_token: providerToken,
            provider_refresh_token: providerRefreshToken,
            provider_token_expires_at: providerExpiresAt, // Store expiry too
            // Add any other metadata you want to persist here
          },
        });

        if (updateError) {
          console.error(
            "OAuth callback: Error updating user metadata with provider tokens:",
            updateError
          );
          // Decide how to handle: log, redirect to specific error, or continue?
          // Continuing might be okay if the session itself is valid
        } else {
          console.log(
            "OAuth callback: Successfully saved provider tokens to user_metadata."
          );
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      console.error(
        "OAuth callback: Error exchanging code for session:",
        exchangeError
      );
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
