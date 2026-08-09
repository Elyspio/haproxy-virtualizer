# Domain glossary

## Backend

An HAProxy destination pool that owns one or more servers and the policy used to distribute traffic between them.

## Backend reference

A frontend relationship that targets a backend, either as its default backend or through a conditional backend-switching rule.

## Configuration draft

The complete HAProxy configuration currently being edited locally but not yet saved.

## Saved baseline

The latest HAProxy configuration loaded from or successfully saved to the managed instance. Discarding a configuration draft restores this state.

## Runtime status

Operational telemetry for backends and servers. Refreshing runtime status does not change the configuration draft.

## Server

One concrete traffic destination owned by a backend.
