# Hooks

The plugin registers no pre-tool hooks in Copilot, Claude, or portable clients.
The empty hook configurations preserve package paths without running commands.
Installing the plugin must not intercept unrelated commands or require Node
before the user can inspect or repair their environment.

<!-- equinor-start: no CLI attribution -->

Upstream uses this page to describe command-scoped CLI attribution. This Equinor fork removes it;
see [no CLI attribution](../shared/cli-binary.md#no-cli-attribution).

<!-- equinor-end -->

Restart existing client sessions after updating. A running session can retain
previously loaded hook definitions until it reloads the plugin.
