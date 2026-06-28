# Arbeitszeitbüro

Arbeitszeitbüro is a self-hosted time tracking app for German teams.

I built it for companies that want to record working time, vacations, sick leave, overtime, and approvals without moving employee data into an external SaaS product. The focus is practical: a clean web app, German holiday templates, CSV migration, admin workflows, email notifications, local backups, and Docker-based hosting with HTTPS.

The app is available in German and English.

> This project is not legal advice. German working-time, employment, data-protection, retention, works council, and collective-agreement requirements depend on the company using the app. Before using it in production, have the setup reviewed by the responsible legal/data-protection people.

## What It Can Do

- Track work, breaks, and clock-out events.
- Show daily, weekly, monthly, yearly, and all-time balances.
- Keep an action log of time tracking events.
- Manage admins and employees with invite-based accounts.
- Enforce safe passwords and forced first password changes for initial accounts.
- Let employees request vacation, sick leave, Überstunden-Ausgleich, overtime payout, and time corrections.
- Let admins approve, reject, undo, and audit approved requests.
- Show approved absences in employee calendars.
- Share calendars directly or through groups.
- Manage German public holidays through country/state/region templates.
- Edit, disable, or add holidays manually, including partial free days such as `50%`.
- Calculate holiday credit from each employee's expected working time instead of using a flat eight-hour day.
- Store employee work-time and vacation rules with effective dates.
- Override current vacation and plus/minus balances during migration.
- Import historical time tracking data from CSV.
- Export time data as CSV by day, week, month, year, or complete history.
- Send SMTP email notifications for invites and request decisions.
- Store data in SQLite with automatic weekly local backups.
- Run as a web app, Docker deployment, or compact Tauri v2 desktop shell.

## Tech Stack

- React, TypeScript, Vite
- Express, Node.js, SQLite
- Tauri v2 for the desktop shell
- Docker Compose and Caddy for HTTPS self-hosting

## License

This project is source-available under [LICENSE.md](LICENSE.md).

Private individuals may use it for free. Companies and organizations may use it for free up to 10 active users. Larger organizations need a paid license or an explicit free-grant license.

For license questions, open an issue in this repository.

## Self-Hosting With Docker

Requirements:

- Docker and Docker Compose
- A DNS name pointing to the server, for example `time.example.com`
- Ports `80` and `443` reachable by Caddy for automatic HTTPS certificates

Create your environment file:

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` and set at least:

```text
APP_HOST=time.example.com
APP_BASE_URL=https://time.example.com
INITIAL_ADMIN_NAME=<admin name>
INITIAL_ADMIN_EMAIL=<admin email>
INITIAL_ADMIN_PASSWORD=<unique temporary password>
```

Start the app:

```bash
docker compose --env-file .env.docker up -d --build
```

Then open `https://time.example.com`, log in with the initial admin account, and change the temporary password when prompted.

## First Setup

After the first login:

1. Configure SMTP under `Einstellungen -> Mailserver`.
2. Invite the real admin accounts.
3. Configure holidays, groups, work-time rules, vacation entitlement, and backups.
4. Test invite emails and request approval emails.
5. Test CSV export and backup restore before relying on the system.

## Local Development

Requirements:

- Node.js 24 or newer
- npm

For a fresh local database, set an initial admin before starting the app:

```powershell
$env:INITIAL_ADMIN_NAME = "Your Name"
$env:INITIAL_ADMIN_EMAIL = "you@example.com"
$env:INITIAL_ADMIN_PASSWORD = "<unique temporary password>"
npm install
npm run dev
```

Open:

- Web app: `http://localhost:5173`
- API health: `http://localhost:4177/api/health`

## Desktop Shell

The Tauri project lives in [src-tauri](src-tauri).

Run it during development:

```bash
npm run desktop:dev
```

Build it:

```bash
npm run desktop:build
```

The desktop shell opens the compact clocking view.

## Testing

```bash
npm run build
npm run lint
npm run test:browsers
```

The browser smoke test covers Chromium desktop/mobile, WebKit desktop/mobile, and Firefox desktop.

## Data And Security Notes

Arbeitszeitbüro stores employee data. Treat the SQLite database, backups, SMTP credentials, and license keys as confidential.

For production, use:

- HTTPS
- strong admin passwords
- restricted server access
- regular backup restore tests
- a clear retention/deletion policy
- documented access rights for admins

## Legal References

Useful starting points for a German deployment:

- BAG decision on working-time recording: <https://www.bundesarbeitsgericht.de/entscheidung/1-abr-22-21/>
- German Arbeitszeitgesetz: <https://www.gesetze-im-internet.de/arbzg/>
- CJEU case C-55/18 on working-time recording: <https://curia.europa.eu/jcms/upload/docs/application/pdf/2019-05/cp190061en.pdf>
- EDPB GDPR lawful processing guide: <https://www.edpb.europa.eu/sme-data-protection-guide/process-personal-data-lawfully_en>

These links are only a starting point. Each company is responsible for checking its own legal, contractual, data-protection, and works council requirements.
