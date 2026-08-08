# EZoom

EZoom is a self-hosted virtual classroom and collaboration platform for educators, students, schools, trainers, and online communities. It combines live classroom rooms, educator camera and microphone broadcasting, screen sharing, a synchronized whiteboard, chat, Q&A, polls, resources, QR joining, recording, and optional Gemini-powered learning tools.

For commercial licensing, education deployments, integrations, or collaboration, email **eozoe2025@gmail.com**.

## Public trial account

Anyone may evaluate EZoom locally using the trial educator account:

- Email: `user@ejoecast.com`
- Password: `user123!`
- Meeting duration: 30 minutes

The 30-minute limit is enforced by the server and starts when the educator launches the meeting. Students do not need an account. They join with their name, email, four-digit session code, and the math security answer shown on the landing page.

Administrator credentials are intentionally excluded from source control and documentation. Set `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` privately in the deployment environment.

## Capabilities

- Separate educator authentication and student entry
- Unlimited superadmin meetings and server-enforced 30-minute trial meetings
- Four-digit room codes, QR join links, and a math security check
- Waiting-room approval and classroom locking
- Educator camera broadcasting with synchronized camera on/off state
- Live educator microphone audio with student playback controls
- Screen sharing with WebRTC and compatibility-frame fallback
- Collaborative whiteboard and annotation tools
- Chat, announcements, questions, polls, quizzes, and shared resources
- Session recording and post-session reports
- Optional Gemini-generated notes and quizzes
- LAN-aware QR URLs for devices on the same network

## Requirements

Choose either:

- Docker Engine 24+ with Docker Compose, or
- Node.js 22+ and npm 10+

Camera, microphone, screen sharing, and browser audio playback require a modern Chromium-based browser. Remote production deployments should use HTTPS because browsers restrict media-device APIs on insecure non-local origins.

## Quick start with Docker

```bash
git clone https://github.com/ejoetso/EZoom.git
cd EZoom
cp .env.example .env
docker compose up --build -d
```

Open `http://localhost:3000`.

Check container status and logs:

```bash
docker compose ps
docker compose logs -f ezoom
```

Stop the deployment:

```bash
docker compose down
```

## Native local development

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. The development server listens on all interfaces, so another device on the same network can open `http://YOUR_LAN_IP:3000`.

Useful validation commands:

```bash
npm run lint
npm run build
npm audit
```

To test the production bundle without Docker:

```bash
npm run build
npm start
```

## Configuration

Copy `.env.example` to `.env` and adjust these variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `APP_URL` | Public application URL | `http://localhost:3000` |
| `GEMINI_API_KEY` | Optional Gemini API key for AI notes and quizzes | empty |
| `SUPERADMIN_EMAIL` | Unlimited administrator login | required secret |
| `SUPERADMIN_PASSWORD` | Unlimited administrator password | required secret |
| `TRIAL_EMAIL` | Public trial educator login | `user@ejoecast.com` |
| `TRIAL_PASSWORD` | Public trial educator password | `user123!` |
| `TRIAL_DURATION_MINUTES` | Trial meeting duration | `30` |

Never commit a real `.env` file. It is excluded by `.gitignore` and `.dockerignore`.

## User workflow

### Educator

1. Open the EZoom landing page.
2. Sign in through the Educator Portal.
3. Enter the educator name, meeting title, and optional course name.
4. Choose waiting-room and chat settings.
5. Create the session and share its four-digit code or QR link.
6. Confirm microphone and camera settings in the lobby.
7. Launch the meeting. Camera, microphone, timer, screen sharing, whiteboard, chat, polls, and participant controls become available.
8. Turn the camera or live microphone off from their meeting controls when required.

### Student

1. Open the landing page or scan the educator's QR code.
2. Enter a name and email address.
3. Enter the four-digit session code.
4. Solve the displayed math security question.
5. Enter the lobby and join or wait for educator approval.
6. If prompted, select **Tap to Enable Live Host Voice** once to satisfy browser autoplay rules.

## Production implementation

1. Deploy the Docker image behind a TLS reverse proxy such as Caddy, Nginx, Traefik, Cloudflare Tunnel, or a managed container service.
2. Set `APP_URL` to the final HTTPS URL.
3. Replace both educator passwords through secrets or protected environment variables.
4. Set `GEMINI_API_KEY` only when AI features are required.
5. Allow inbound traffic to the exposed HTTP port and ensure WebSocket upgrade headers are preserved by the reverse proxy.
6. Configure HTTPS before testing camera, microphone, or screen sharing from remote devices.
7. Monitor `/api/health` for container health.

Example Nginx proxy location:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Architecture and operational notes

- The React/Vite client and Express/WebSocket server are packaged as one service.
- Current classroom state is stored in server memory. Restarting the process or container clears active rooms and codes.
- A single application instance is recommended unless room state and WebSocket routing are moved to shared infrastructure such as Redis.
- Camera compatibility frames and microphone PCM audio use the WebSocket channel. Size and backpressure limits protect the session from runaway client buffers.
- WebRTC screen sharing may require TURN infrastructure for reliable internet-wide use behind strict NAT or enterprise firewalls.
- The bundled account system is suitable for trials and controlled deployments. Production multi-tenant use should replace it with persistent users, hashed passwords, sessions or signed tokens, rate limiting, and audit logs.

## Security checklist

- Change the default superadmin password.
- Serve the application through HTTPS.
- Store secrets outside source control.
- Restrict administrative network access where appropriate.
- Add authentication rate limiting before public deployment.
- Add persistent storage and a backup policy if meeting history must survive restarts.
- Review privacy and consent requirements before enabling recording.

## Support and collaboration

For commercial use, education use, custom deployment, product integration, or collaboration, contact **eozoe2025@gmail.com**.
