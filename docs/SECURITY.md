# Local trust boundary

PhantomLab is an unauthenticated, single-user local development application. Bind it only to loopback. It is not designed as an internet-hosted multi-tenant service.

- HTTP Host is restricted to loopback (plus the test client hostname). Cross-site mutations and unapproved browser Origin values are rejected.
- Registration accepts plain HTTP localhost metadata without embedded credentials. It does not grant browser execution permission.
- The actual runner only permits its own `/demo/` fixture and `/fonts/` URLs on the configured loopback port. Requests to other origins and routes are aborted. Browser service workers are blocked in testing contexts.
- Fresh browser contexts use fake guest sessions. No actual payment provider, credentials, email, card information or customer data is requested.
- Agents receive no shell, filesystem, SQL or arbitrary executable-code tool. The scenario enum is the execution boundary; the operator’s code is reviewed repository code.
- Model explanations are unverified interpretations. Deterministic tools own assertions and database observations. Invalid inference is recorded as unavailable.
- One browser, maximum ten scenario runs, bounded queue depth, per-run timeouts, total experiment timeout and explicit cancellation limit resource use.
- Cancellation stops browser execution and keeps completed evidence. A request already sent to the fixture can still finish. Interrupted actions are not automatically repeated.
- Logs record controlled fixture paths, not request headers or session cookie values. Real credentials are prohibited. Trace ZIPs inherently include fixture request/session details: keep them local and review them before sharing.
- Artifact downloads validate generated IDs and filenames. Static file serving checks resolved paths. No API can read unrelated local files.
- Notes validate text length, revision and idempotency keys. Conflicts require explicit review.

The fixture’s release B defects are intentional and isolated. The hidden evaluation manifest must not enter agent prompts. Do not adapt this worker to production applications without a reviewed origin allowlist, explicit action approval policy, authentication, and tool-specific safeguards.

Local administrators and same-user local processes can access this unauthenticated backend and its files. Host/Origin controls mitigate browser cross-origin attacks; they are not OS-level authentication. A real machine-wide network sandbox, credential vault, multi-user authorization, signed artifacts and automatic artifact retention policy are future work.
