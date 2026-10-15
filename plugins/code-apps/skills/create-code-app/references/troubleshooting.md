# Troubleshooting

## Common npm Scripts

| Command         | Purpose                                  |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Local dev server (http://localhost:5173) |
| `npm run build` | Build for production                     |
| `npm run lint`  | Run ESLint                               |

## Common Issues

| Problem                 | Solution                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| Build fails             | Check Node.js 22+ version, run `npm install`                       |
| Build fails with TS6133 | Unused imports cause errors in strict mode. Remove unused imports. |
| Auth error              | Run `pa auth logout` (or `power-apps logout` on `power-apps`-only projects), then retry — the CLI will re-prompt browser login. |
| No data                 | Verify user has read access to table, check browser console        |
| Local testing           | Use same browser profile as Power Platform auth                    |
| CDN font blocked by CSP | See [EDS Font Loading (CSP)](#eds-font-loading-csp) below          |
| `CachePersistenceError` from `pa` | Dev container without a keyring. See [Dev Containers](#dev-containers) below |
| `pac auth create` fails on `xdg-open`, hangs after account selection, or reports `Expected POST request ... but received GET` | See [Dev Containers](#dev-containers) below |
| Local Play stays on "Fetching your app" in a dev container | See [Dev Containers](#dev-containers) below |

## Deploy Errors

| Error                               | Fix                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| "environment config does not match" | Update `environmentId` in `power.config.json` to match the target environment, then retry.                      |
| DNS/network error                   | Try different environment or contact admin.                                                                      |
| Auth error / token expired          | Run `pa auth logout`, then retry `pa app push` — CLI will prompt re-authentication via browser. On `power-apps`-only projects use `power-apps logout` then `power-apps push`.  |

## Resources

**Docs:**
- [Code Apps](https://learn.microsoft.com/power-apps/developer/code-apps/)
- [Code Apps CSP Configuration](https://learn.microsoft.com/power-apps/developer/code-apps/how-to/content-security-policy)
- [CLI Reference](https://learn.microsoft.com/power-platform/developer/cli/reference/)
- [Connectors](https://learn.microsoft.com/en-us/connectors/connector-reference/)
- [Azure DevOps API](https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2)
- [Dataverse API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview)

**GitHub:**
- [Template](https://github.com/microsoft/PowerAppsCodeApps)
- [Issues](https://github.com/microsoft/PowerAppsCodeApps/issues)

---

## Dev Containers

In a VS Code dev container (`REMOTE_CONTAINERS` or `CODESPACES` is set), the default sign-in, deploy and Local Play paths fail for three separate reasons. The error messages do not name the cause.

### `pa` cannot open its token cache

`npx pa auth status` fails with `CachePersistenceError` before any sign-in. The CLI requires a Linux keyring (libsecret over D-Bus), which dev containers do not have, and it has no option to opt out.

**Fix:** use the PAC CLI in a dev container. Sign in with `pac auth create` (below), then:

| Operation  | Outside a dev container | In a dev container                                              |
| ---------- | ----------------------- | --------------------------------------------------------------- |
| Initialize | `pa app init`           | `pac code init --displayName '<app-name>' -e <environment-id>` |
| Deploy     | `pa app push`           | `pac code push --environment <environment-id>`                  |

### `pac auth create` cannot complete a browser sign-in

- It opens the sign-in page with `xdg-open`, which is not installed. VS Code provides a host-browser opener in `$BROWSER` instead.
- Its redirect listener binds to IPv6 `[::1]:<random port>` only. VS Code port forwarding does not reach IPv6-only listeners, so the browser hangs after you select your account.
- Any stray request to the callback port, such as a browser prefetch or opening the URL to test it, makes `pac` quit with `Expected POST request for form_post response mode, but received GET`.

**Fix:**

1. Start this bridge in the background. It waits for the `pac` sign-in listener, then forwards IPv4 loopback to it:

   ```js
   // Bridge IPv4 loopback to pac's IPv6-only sign-in listener. Start it first, then run `pac auth create`.
   const net = require('net');
   const { execSync } = require('child_process');

   function findPacPort() {
     const lines = execSync('ss -ltnp', { encoding: 'utf8' }).split('\n');
     const match = lines.find((line) => /\[::1\]:\d+/.test(line) && line.includes('"dotnet"'));
     return match ? Number(match.match(/\[::1\]:(\d+)/)[1]) : undefined;
   }

   function bridge(port) {
     net.createServer((client) => {
       const upstream = net.connect(port, '::1');
       client.pipe(upstream).pipe(client);
       upstream.on('error', () => client.destroy());
       client.on('error', () => upstream.destroy());
     }).listen(port, '127.0.0.1', () => console.log(`bridge 127.0.0.1:${port} -> [::1]:${port}`));
   }

   const timer = setInterval(() => {
     const port = findPacPort();
     if (port) {
       clearInterval(timer);
       bridge(port);
     }
   }, 200);
   ```

2. Run `pac auth create` with an `xdg-open` shim that calls `$BROWSER`:

   ```bash
   mkdir -p /tmp/pac-shim
   printf '#!/bin/sh\nexec "$BROWSER" "$@"\n' > /tmp/pac-shim/xdg-open
   chmod +x /tmp/pac-shim/xdg-open
   PATH="/tmp/pac-shim:$PATH" pac auth create --environment <environment-id>
   ```

3. Complete the sign-in in the browser. Do not open the callback URL yourself, and ignore VS Code's offer to open the forwarded port. Stop the bridge once `pac` reports success.

### Local Play hangs on "Fetching your app"

Node resolves `localhost` to `::1` first in the container, so the Vite dev server listens on IPv6 only and VS Code port forwarding cannot reach it. Passing `--host 127.0.0.1` fixes the binding, but the Vite plugin then prints a `127.0.0.1` app URL, which the Power Apps player rejects with `InvalidOrigin: appUrl is not a valid URL`.

**Fix:** set `server.host` in `vite.config.ts`. The server then listens on all container interfaces, and the plugin still prints a `localhost` URL. Projects created with `/create-code-app` already have this.

```ts
export default defineConfig({
  plugins: [react(), powerApps()],
  server: { host: process.env.REMOTE_CONTAINERS ? true : undefined },
});
```

---

## EDS Font Loading (CSP)

Power Apps code apps enforce a Content Security Policy (CSP) by default. When loading external resources such as the EDS CDN font stylesheet (`https://cdn.eds.equinor.com/font/eds-uprights-vf.css`), the browser blocks them because the default CSP only allows:

| Directive   | Default value           |
| ----------- | ----------------------- |
| `style-src` | `'self' 'unsafe-inline'` |
| `font-src`  | `'self'`                |

### Symptom

Console errors like:

```
Loading the stylesheet 'https://cdn.eds.equinor.com/font/eds-uprights-vf.css' violates the
following Content Security Policy directive: "style-src 'self' 'unsafe-inline'".
```

### Fix: Update CSP in Power Platform Admin Center

1. Sign in to the [Power Platform admin center](https://admin.powerplatform.microsoft.com/)
2. Navigate to **Manage** → **Environments** → select the target environment
3. Select **Settings** → expand **Product** → select **Privacy + Security**
4. Under **Content security policy**, select the **App** tab
5. For **style-src**: toggle OFF the default, add your CDN origin (e.g. `https://cdn.eds.equinor.com`)
6. For **font-src**: toggle OFF the default, add the same CDN origin
7. Save. Changes may take a few minutes to propagate due to caching. Hard-refresh the app or test in an incognito window.

> **Important:** Custom values are **merged** with the default values. You only need to add the external origin; `'self'` and `'unsafe-inline'` are retained automatically.

### Automation

For programmatic management, Microsoft provides a REST API and PowerShell helper functions. See the official documentation: [Configure CSP for Code Apps](https://learn.microsoft.com/power-apps/developer/code-apps/how-to/content-security-policy).

> **Note for Equinor (and similar tenants with conditional access):** Device code flow is blocked by conditional access policies. The `MSAL.PS` module may have DLL conflicts with the PowerApps Administration module on macOS/Linux. If automating from non-Windows systems, you may need to implement OAuth2 authorization code + PKCE with a localhost redirect listener, or authenticate on a Windows machine where `MSAL.PS` works reliably.
