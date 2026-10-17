# Kitchen invites

Share one kitchen (household) with a spouse or family member. Invite links do not send email. Copy the URL and send it yourself.

People (dietary profiles such as Parent A or Child B) stay separate from kitchen members. A kitchen member is a signed-in user who can see the same recipes, plans, and people.

## Who can do what

| Action | Owner | Admin | Member | Viewer |
| --- | --- | --- | --- | --- |
| Create or revoke invite links | Yes | Yes | No | No |
| Change a member role | Yes | No | No | No |
| Remove another member | Yes | No | No | No |
| Leave the kitchen | Yes, unless last owner | Yes | Yes | Yes |

Invite roles are `admin`, `member` (default), or `viewer`. You cannot grant `owner` through a link. The last owner cannot leave or be demoted.

## Create a link

1. Open Settings
2. Create an invite with a role and expiry (1-30 days, default 7)
3. Copy the URL (`/invite/<token>`)

Pending links stay listed until they expire or you revoke them. A link can be used by more than one person until then.

## Open a link

- Signed out: sign up or sign in through Clerk, then you land in the inviting kitchen
- Signed in: accept the invite and switch to that kitchen
- A brand-new user does not get an extra empty kitchen

If you already belong to more than one kitchen, OvenLovin keeps the last kitchen you selected. After you accept an invite, that kitchen becomes active. Settings includes a kitchen switcher when you have more than one.

## REST

Authenticated, scoped to the active kitchen:

- `GET /api/v1/households/mine` - kitchens you belong to
- `POST /api/v1/households/select` - `{ householdId }`
- `GET /api/v1/households/members`
- `PATCH /api/v1/households/members/{userId}` - `{ role }` (owner)
- `DELETE /api/v1/households/members/{userId}` (owner)
- `POST /api/v1/households/leave`
- `GET /api/v1/households/invites` (owner or admin)
- `POST /api/v1/households/invites` - `{ role?, expiresInDays? }` (owner or admin)
- `DELETE /api/v1/households/invites/{id}` (owner or admin)

Public / accept:

- `GET /api/v1/invites/{token}` - preview (no auth)
- `POST /api/v1/invites/{token}/accept` - join as the signed-in user

## MCP

- `manage_kitchen_invites` - `list`, `create`, `revoke`
- `manage_kitchen_members` - `list`, `update_role`, `remove`, `leave`

API keys are household-scoped and can manage invites for that kitchen. Share the returned `path` (`/invite/<token>`); the server does not send email.
