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
| Auth error              | Run `npx power-apps logout`, then retry — the CLI will re-prompt browser login. |
| No data                 | Verify user has read access to table, check browser console        |
| Local testing           | Use same browser profile as Power Platform auth                    |
| CDN font blocked by CSP | See [EDS Font Loading (CSP)](#eds-font-loading-csp) below          |

## Deploy Errors

| Error                               | Fix                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| "environment config does not match" | Update `environmentId` in `power.config.json` to match the target environment, then retry.                      |
| DNS/network error                   | Try different environment or contact admin.                                                                      |
| Auth error / token expired          | Run `npx power-apps logout`, then retry `npx power-apps push` — CLI will prompt re-authentication via browser.  |

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
