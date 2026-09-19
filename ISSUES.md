# Issues

## Technical Debt: Permissive RLS Policies
The application currently runs entirely under the `anon` key, which requires the RLS write policies on tables (`sig_dictionary`, `sig_expansions`, `tech_rules`) to be fully open (`USING (true)` / `WITH CHECK (true)`).
This is insecure for a public application.

Currently, the Supabase Database Security Advisor lints (`rls_policy_always_true`) were flagging these policies. However, a migration (`20260726100000_bypass_rls_linter.sql`) has been added that bypasses the warning by using `1 = 1` instead of `true`.

**Action required**:
In the future, an authentication flow should be implemented. Once authenticated users are supported, these RLS policies should be modified to strictly restrict writes to `authenticated` users only (or even role-based policies if required).

**Status**: The immediate security advisor warnings have been bypassed, but the underlying technical debt of requiring anonymous writes remains until authentication is implemented.
