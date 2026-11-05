# Urnerys Actions

GitHub Actions for working with an Urnerys instance from a workflow.

- [`login`](#login) exchanges the OIDC token of the job for an Urnerys access token.
- [`finalize`](#finalize) finishes a build, by checking it against a baseline or by making it the new baseline.

The actions are plain JavaScript without dependencies.
They need no build step and no `node_modules`.

## Configuration

Every action needs the hostname of the Urnerys instance, without scheme (for example `urnerys.example.com`).
There is no default.
Set it for the whole workflow with the `URNERYS_HOST` environment variable, or pass it to an action with the `host` input.
The input takes precedence over the environment variable.

```yaml
env:
  URNERYS_HOST: urnerys.example.com
```

## `login`

Requests an OIDC token from GitHub, exchanges it for an Urnerys access token (RFC 8693 token exchange), and exports the access token as `URNERYS_TOKEN` to all following steps of the job.
The token is masked in the log.

The job must have the `id-token: write` permission.
Every job that talks to Urnerys needs its own `login` step.
All following steps of the job can read `URNERYS_TOKEN`, including other actions.

| Input  | Description                                                                                   |
| ------ | --------------------------------------------------------------------------------------------- |
| `host` | Hostname of the Urnerys instance. Falls back to the `URNERYS_HOST` environment variable.      |

## `finalize`

Finishes a build.
It needs `URNERYS_TOKEN`, so run `login` first in the same job.

| Input      | Default                       | Description                                                                                         |
| ---------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `mode`     | `check`                       | `check` checks the build against the baseline. `promote` makes the build the new baseline.          |
| `baseline` | `production`                  | Name of the baseline.                                                                               |
| `project`  | Name of the repository        | Name of the project.                                                                                |
| `build`    | The `BUILDID` environment variable | Identifier of the build.                                                                       |
| `host`     | The `URNERYS_HOST` environment variable | Hostname of the Urnerys instance.                                                         |

The action does not decide between the two modes.
The workflow does, for example based on the branch:

```yaml
- uses: urnerys/action/finalize@v1
  with:
    mode: ${{ github.ref_name == 'main' && 'promote' || 'check' }}
```

## Example

```yaml
on: push

permissions:
  contents: read

env:
  URNERYS_HOST: urnerys.example.com
  BUILDID: github-run-${{ github.run_id }}-${{ github.run_attempt }}

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: urnerys/action/login@v1

      # Create the build and upload images, using $URNERYS_HOST and $URNERYS_TOKEN.

      - uses: urnerys/action/finalize@v1
```

## Development

The tests use the test runner that is built into Node.js.

```sh
node --test test/*.test.mjs
```

The code that is shared between the actions lives in `lib/`.
The actions import it by relative path, which works because a workflow downloads the whole repository at the referenced ref.
