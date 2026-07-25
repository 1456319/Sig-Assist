# Issues

## Technical Debt: Permissive RLS Policies
The application currently runs entirely under the `anon` key, which requires the RLS write policies on tables (`sig_dictionary`, `sig_expansions`, `tech_rules`) to be fully open (`USING (true)` / `WITH CHECK (true)`).
This is insecure for a public application.

Currently, the Supabase Database Security Advisor lints (`rls_policy_always_true`) are flagging these policies. The intended fix is to implement authentication and then restrict writes to `authenticated` users only.

**Action required**:
In the future, an authentication flow should be implemented. Once authenticated users are supported, these RLS policies should be modified to strictly restrict writes to `authenticated` users only (or even role-based policies if required). This will resolve the security advisor warnings.

*Note: Please do not delete this file until this issue is resolved.*
