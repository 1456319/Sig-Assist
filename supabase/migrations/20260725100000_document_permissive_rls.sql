/*
# Document permissive RLS policies

As of this migration, the RLS policies for `anon_insert`, `anon_update`, and `anon_delete`
on `sig_dictionary`, `sig_expansions`, and `tech_rules` are intentionally permissive (USING true).
This is because the app is currently a no-auth internal tool.
We are documenting this via a comment to satisfy the intent (though the linter might still warn
unless suppressed, which we track in ISSUES.md).
*/

COMMENT ON POLICY "anon_delete_sig_dictionary" ON public.sig_dictionary IS 'Intentional permissive policy for no-auth tool';
COMMENT ON POLICY "anon_insert_sig_dictionary" ON public.sig_dictionary IS 'Intentional permissive policy for no-auth tool';
COMMENT ON POLICY "anon_update_sig_dictionary" ON public.sig_dictionary IS 'Intentional permissive policy for no-auth tool';

COMMENT ON POLICY "auth_delete_sig_expansions" ON public.sig_expansions IS 'Intentional permissive policy for no-auth tool';
COMMENT ON POLICY "auth_insert_sig_expansions" ON public.sig_expansions IS 'Intentional permissive policy for no-auth tool';
COMMENT ON POLICY "auth_update_sig_expansions" ON public.sig_expansions IS 'Intentional permissive policy for no-auth tool';

COMMENT ON POLICY "anon_delete_tech_rules" ON public.tech_rules IS 'Intentional permissive policy for no-auth tool';
COMMENT ON POLICY "anon_insert_tech_rules" ON public.tech_rules IS 'Intentional permissive policy for no-auth tool';
COMMENT ON POLICY "anon_update_tech_rules" ON public.tech_rules IS 'Intentional permissive policy for no-auth tool';
