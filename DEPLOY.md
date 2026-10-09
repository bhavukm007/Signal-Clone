# Deploy the demo to Render and Vercel

This guide configures the Render API first, then the Vercel frontend, then updates backend CORS with the deployed Vercel origin. The repository contains `render.yaml`, a root `vercel.json` framework hint, and `frontend/vercel.json` for a Vercel project whose Root Directory is `frontend`. These instructions describe dashboard actions only; no service or account is created by following the local verification workflow.

The Render Free web service sleeps after 15 minutes without traffic and can take about a minute to start. Its filesystem is ephemeral: SQLite data and uploads are lost on sleep, restart, or redeploy. Startup recreates the database schema and demo seed. Persistent disks are available only on paid service plans. See [Render Free services](https://render.com/docs/free), [Render Blueprints](https://render.com/docs/blueprint-spec), and [Vercel project settings](https://vercel.com/docs/project-configuration/project-settings).

## 1. Deploy the backend on Render

1. Sign in to [Render](https://dashboard.render.com).
2. From the dashboard, choose **New + → Blueprint**.
3. Select the repository that contains this project and choose the branch to deploy. Confirm that the Blueprint file is the repository-root `render.yaml`.
4. Choose **Apply**. Render reads `rootDir: backend`, installs `backend/requirements.txt`, and starts `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. The health check path is `/health`.
5. If Render asks for unsynced environment values while creating the service, enter these values. Use `https://pending.invalid` temporarily for CORS; replace it after the frontend is deployed.

   | Backend variable | Initial value |
   |---|---|
   | `ENVIRONMENT` | `production` |
   | `DATABASE_URL` | `sqlite:///./signal.db` |
   | `CORS_ORIGINS` | `https://pending.invalid` |
   | `JWT_SECRET` | A new random 64-character hex value; generate one with `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `OTP_CODE` | `123456` |
   | `UPLOAD_DIR` | `uploads` |
   | `MAX_UPLOAD_BYTES` | `10485760` |

   `PORT` is set by Render and must not be entered manually. Python is pinned to 3.11 by `backend/.python-version`.

6. Wait for the deploy to finish. Select the `signal-clone-api` web service and copy its URL from the service header, for example `https://signal-clone-api.onrender.com`.
7. Open `https://YOUR-RENDER-SERVICE.onrender.com/health`. A ready API returns `{"status":"ok"}`. Startup creates the schema and seed before the app begins accepting traffic.

## 2. Deploy the frontend on Vercel

1. Sign in to [Vercel](https://vercel.com/dashboard) and choose **Add New… → Project**.
2. Import the same repository and choose **Configure Project**.
3. Open **Root Directory → Edit**, select `frontend`, and confirm. Verify that the Framework Preset is **Next.js**. `frontend/vercel.json` sets the `nextjs` framework preset; Vercel's root directory is a project setting, so it is selected here in the dashboard.
4. Under **Environment Variables**, add the following values. Select **Production**; also select **Preview** and **Development** if those deployments should use the same backend.

   | Frontend variable | Example value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://signal-clone-api.onrender.com/api/v1` |
   | `NEXT_PUBLIC_WS_URL` | Leave unset to derive `wss://signal-clone-api.onrender.com/ws`; or set that exact URL explicitly |

   Replace the example host with the URL copied from Render. Keep `/api/v1` on the API URL. The WebSocket URL is the service origin plus `/ws`, without `/api/v1`.

5. Choose **Deploy**. When the deployment completes, copy the production domain shown on the deployment page, for example `https://signal-clone.vercel.app`.

## 3. Set the final CORS origin and redeploy the backend

1. Return to Render and open the `signal-clone-api` service.
2. Select **Environment → Edit**.
3. Replace `CORS_ORIGINS` with the exact Vercel production origin, including `https://` and with no path or trailing slash. For example: `https://signal-clone.vercel.app`.
4. If a Vercel preview domain also needs API access, add each exact origin as a comma-separated value. Do not use `*` for this credentialed API.
5. Choose **Save, rebuild, and deploy** (or the equivalent save-and-redeploy action shown by Render). Wait for `/health` to return `{"status":"ok"}` again.
6. Open the Vercel site, choose **Get started**, and sign in with `+919000000001` or `+919000000002`; the public demo code is `123456`. Open a second browser profile to try two-account messaging.

## Environment variable reference

| Service | Variable | Example / behavior |
|---|---|---|
| Render | `ENVIRONMENT` | `production`; enables production startup checks |
| Render | `DATABASE_URL` | Free default `sqlite:///./signal.db`; paid disk `sqlite:////data/signal.db` |
| Render | `CORS_ORIGINS` | Exact deployed frontend origin, such as `https://signal-clone.vercel.app` |
| Render | `JWT_SECRET` | Unique random value, at least 32 characters; never commit it |
| Render | `OTP_CODE` | `123456` for this public mock-OTP demo |
| Render | `UPLOAD_DIR` | Free default `uploads`; paid disk `/data/uploads` |
| Render | `MAX_UPLOAD_BYTES` | `10485760` (10 MiB) |
| Render | `PORT` | Injected by Render; the start command binds to it |
| Vercel | `NEXT_PUBLIC_API_URL` | API service URL ending in `/api/v1` |
| Vercel | `NEXT_PUBLIC_WS_URL` | Optional; defaults from `NEXT_PUBLIC_API_URL` using `wss://` for HTTPS and `ws://` for HTTP |

Render marks `CORS_ORIGINS`, `JWT_SECRET`, and `OTP_CODE` as unsynced values in the Blueprint. Enter them in Render's Environment page; only the origin and mock OTP examples above are public demo values. Generate a different `JWT_SECRET` for every deployment.

### Optional persistent disk

Render Free web services do not support persistent disks. To preserve local SQLite data and uploads, use a paid service plan, uncomment the `disk` block in `render.yaml`, set `DATABASE_URL=sqlite:////data/signal.db`, and set `UPLOAD_DIR=/data/uploads`. The disk mount path is `/data`; only files under that path persist.

## Troubleshooting

### CORS errors

- In Render, check `CORS_ORIGINS` against the browser's exact Vercel origin. Include the scheme, omit a trailing slash and path, and separate multiple origins with commas.
- Confirm the environment change finished deploying, then hard-refresh the Vercel page. A CORS error in the browser does not mean the backend health endpoint is down.
- Keep the API URL ending in `/api/v1`; CORS uses only the frontend origin.

### WebSocket does not connect

- Use `wss://YOUR-RENDER-SERVICE.onrender.com/ws` for HTTPS, not an `/api/v1/ws` path. If `NEXT_PUBLIC_WS_URL` is unset, the frontend derives it from `NEXT_PUBLIC_API_URL`.
- Check the browser Network panel for the `/ws` request and confirm the current Vercel deployment was rebuilt after changing public environment variables.
- The realtime manager is in memory and this demo is intended to run as one backend instance.

### Cold-start delay or first login error

- The first request after a free service sleeps can take about a minute. The login flow displays **Waking up the server…** and retries network failures and 502/503/504 responses with backoff for up to about a minute.
- Wait for the retry to finish instead of repeatedly submitting the form. If it still fails, open the Render service logs and confirm the deploy completed, `JWT_SECRET` is configured, and `/health` becomes ready.
- `/health` checks database connectivity. Startup creates tables and reseeds an empty database before the service can pass its health check.

### Upload or missing-data behavior

- Uploads larger than `MAX_UPLOAD_BYTES` (10 MiB by default) are rejected.
- On Render Free, uploaded files and local SQLite data reset when the instance sleeps, restarts, or redeploys. The seeded demo accounts and sample conversations return after an empty database starts; user-created content does not persist.
