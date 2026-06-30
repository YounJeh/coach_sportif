import { setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "./supabase";

export function initApiAuth() {
  setAuthTokenGetter(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  });
}
