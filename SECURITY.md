# Security Policy

## Supported Versions

Security fixes are handled on the latest `main` branch and the most recent npm
package version.

## Reporting a Vulnerability

Please report suspected vulnerabilities by opening a private GitHub security
advisory for this repository. Include:

- the affected version or commit
- a minimal policy fixture or command that reproduces the issue
- expected and observed behavior
- any known workaround

Do not include credentials, private account IDs, live connector payloads, or
customer data in public issues.

## Scope

This package is a local fixture generator and validator. It should not execute
connector actions, contact live services, or write to external accounts as part
of normal operation.
