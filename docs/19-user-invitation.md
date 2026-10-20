# User invitation test

`v2/tests/xenvio-user-invitation.spec.ts` (`@e2e @users`) checks that an admin can invite a user,
that the invitation email reaches the user, and that the user can accept it and get into Xenvio.

## What the product does

| Step | Who | What happens | Source |
|---|---|---|---|
| 1 | Admin | Shipper View → gear → **Users** → **Invite user** (email, role, facility) → `POST /shipper/xenvio_users` | x5.angular `users/`, x5.xenvio `Shipper::XenvioUsers::Creator` |
| 2 | Xenvio | The user is created **inactive** and listed as **Pending**; the "Invitation instructions" email is sent | `User#deactivate_user`, devise_invitable |
| 3 | Invitee | "Accept invitation" opens the **SSO sign-up** (Keycloak, `sso.omniorders.com`), with the email pre-filled. The link carries no Xenvio token: Xenvio recognizes the invitee by email when the SSO sends them back | `User#keycloak_register_link` |
| 4 | Invitee | After signing up, the SSO returns to `<Xenvio>/users/auth/keycloakopenid/callback`; Xenvio signs them in and shows **Account On Hold** | `Users::OmniauthCallbacksController` |
| 5 | Admin | The user is now **Inactive** (invitation accepted, waiting to be activated) | `Fetcher#get_status` |

The test ends at step 5: activating the user is a separate admin action.

## What the test asserts

- Backend right after inviting: status `pending`, the chosen role, exactly the chosen facility.
- The users table shows **Pending**.
- The email arrives, and its link opens the SSO **sign-up** (a new address must not get the
  sign-in), pre-fills the invited email, and returns to **this** Xenvio environment (not
  `localhost:3000` or another `x5*`).
- After signing up, the invitee (a browser context without the admin's cookies) sees
  **Account On Hold**.
- The backend reports the user as `inactive` and the table shows **Inactive**.

## Code map

| Layer | File |
|---|---|
| Scenario | `v2/tests/xenvio-user-invitation.spec.ts` |
| Fixtures | `mailbox`, `userInvitations`, `inviteePage` in `v2/lib/page-object-fixtures.ts` |
| Service | `v2/services/user-invitation-service.ts` (`invite`, `waitForInvitation`, `acceptInvitation`, `status`) |
| Page objects | `xenvio-users-page.ts`, `components/xenvio-user-form-dialog.ts`, `components/xenvio-config-menu.ts`, `sso/keycloak-registration-page.ts`, `xenvio-account-on-hold-page.ts` |
| Email parsing (pure) | `v2/parsers/invitation-email-parser.ts` |
| Inbox port (pure) | `v2/domain/mail/mailbox-port.ts` |
| Inbox adapters | `v2/adapters/mail/` (`mailbox-factory.ts` picks one by `MAILBOX_PROVIDER`) |
| Test data | `v2/test-data/invited-user-builder.ts`, `v2/domain/users/xenvio-user.ts` |
| Backend reads / cleanup | `XenvioApi.listXenvioUsers`, `findXenvioUser`, `deleteXenvioUser` |
| Unit tests | `v2/unit/invitation-email.unit.spec.ts`, `v2/unit/test-data.unit.spec.ts` |

## The test inbox (MAILBOX_PROVIDER)

The test never reads email through a specific website. It asks a `MailboxPort` for an address
(`addressFor(tag)`) and waits for a message (`waitForMessage(address, { subject, timeoutMs })`).
To use a provider, write its adapter in `v2/adapters/mail/` and register it in
`MAILBOX_PROVIDERS` (`mailbox-factory.ts`); the service and the scenario do not change.

Without `MAILBOX_PROVIDER` the test is **skipped** with that reason, so the regression suite still
runs in a checkout or CI job that has no test inbox. An unknown provider, or a provider without
its settings, fails with "Missing required Xenvio environment variables" (Allure category
*Missing environment configuration*).

`INVITATION_EMAIL_TIMEOUT_MS` (default 180000) is how long to wait for the email.

### Supported provider: testmail.app

| Variable | Value |
|---|---|
| `MAILBOX_PROVIDER` | `testmail` |
| `TESTMAIL_API_KEY` | API key from the [testmail.app](https://testmail.app) console |
| `TESTMAIL_NAMESPACE` | Namespace from the same console |

Every address of the namespace already exists (`<namespace>.<tag>@inbox.testmail.app`), so the
test only picks a unique tag (`qa-invite-<stamp>`); nothing is created on the provider. The adapter
(`v2/adapters/mail/testmail-mailbox.ts`) uses the JSON API's live query, which answers as soon as
the email arrives, asks again when the API answers 307 ("nothing yet") or 429, and gives up at
`INVITATION_EMAIL_TIMEOUT_MS`. A wrong key or namespace fails at once with testmail's message.
The emails can also be read by hand in the testmail.app console.

Setup, once: create a testmail.app account, copy the API key and namespace into `.env` (and into
the CI secrets if the test should run there), then:

```bash
npx playwright test --project=xenvio-v2 --grep @users
```

### Why not yopmail

Yopmail's web inbox shows a Cloudflare **"Verify you are human"** check to automated browsers
(confirmed headless on 19/10/2026) and it has no API. A test must not try to get around a
human-verification check, so yopmail cannot be the automated inbox. It is still fine for reading
an invitation by hand.

## Test data

- Address: `<provider prefix>qa-invite-<stamp>@<provider domain>` (testmail: `<namespace>.qa-invite-<stamp>@inbox.testmail.app`), unique per run (date, time and
  a random suffix), so parallel workers never invite the same address.
- The invitee's SSO password is random per run and never logged or attached to the report.
- The **Xenvio user** is deleted when the test ends, passed or failed (`testData.track('xenvioUser', ...)`),
  and the purge finds leftovers by the `qa-invite-<stamp>` part of the email
  ([18-test-data-cleanup.md](18-test-data-cleanup.md)).
- The **SSO account is not deleted**: the test has no admin access to the SSO, and it must not
  borrow the backend's SSO credentials. Each run therefore leaves one SSO account with a
  throw-away address. Ask the platform team for a test realm or a periodic cleanup if that matters.

## Prerequisites

- `XENVIO_EMAIL` must be an **admin**: the Users screen and its API are admin only.
- The QA environment must actually send email (SMTP configured).
- `WAREHOUSE_XENVIO` is the facility given to the invited user (role "User").

## Known limits

- **Product defect found on 20/10/2026 (x52):** the "Accept invitation" link has `//realms` in its
  path (`keycloak_site` ends with `/` and `User#keycloak_register_link` appends `/realms`), and
  Keycloak answers `{"error":"missingNormalization"}`. The test fails on purpose at "Verify the
  invitation link" until the backend builds the link without the double slash.

- If the SSO realm starts requiring email verification, the sign-up stays on an SSO page; the test
  fails saying what the SSO shows, instead of waiting for a Xenvio screen.
- The run creates a real account in an external SSO, so start it deliberately:

```bash
npx playwright test --project=xenvio-v2 --grep @users
```
