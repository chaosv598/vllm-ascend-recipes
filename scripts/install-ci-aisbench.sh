#!/usr/bin/env bash
set -euo pipefail

# This helper prepares one job's mutable benchmark installation. Callers should
# source the output only after success and may treat failure as a warning.
# CI_AISBENCH_ENV_DIR, when supplied, must name a new directory whose parent
# exists. The caller owns the venv's lifetime; never share it across jobs.
usage() {
    echo "Usage: $0 --env-file PATH"
}

env_file=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --env-file)
            [[ $# -ge 2 && -n "$2" && -z "$env_file" ]] || { usage >&2; exit 2; }
            env_file=$2
            shift 2
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            usage >&2
            exit 2
            ;;
    esac
done
[[ -n "$env_file" ]] || { usage >&2; exit 2; }

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
constraints="$script_dir/ci-aisbench-constraints.txt"
package=ais_bench_benchmark==3.1.20260630

if [[ -n "${CI_AISBENCH_ENV_DIR:-}" ]]; then
    # mkdir deliberately rejects existing environments, including concurrent
    # attempts to use the same override. Never reuse patched model configs.
    mkdir -- "$CI_AISBENCH_ENV_DIR"
    venv_dir=$(cd -- "$CI_AISBENCH_ENV_DIR" && pwd -P)
else
    venv_dir=$(mktemp -d /tmp/ci-aisbench.XXXXXX)
fi

"${PYTHON:-python3}" -m venv --system-site-packages "$venv_dir"
venv_python="$venv_dir/bin/python"

pip_install() {
    # Preserve index/network settings but disallow destination overrides from
    # pip environment variables or configuration files. pip in a venv with
    # system-site-packages can shadow image packages, but cannot uninstall them.
    env -u PIP_TARGET -u PIP_PREFIX -u PIP_USER -u PIP_PYTHON \
        PIP_CONFIG_FILE=/dev/null \
        "$venv_python" -m pip --require-virtualenv install \
        --constraint "$constraints" "$@"
}

# Force only AISBench itself into the private venv even if the image already
# has the pinned release. Ignoring all installed dependencies would duplicate
# large framework packages. Resolve dependencies in a separate normal pass.
pip_install --ignore-installed --no-deps "$package"
pip_install "$package" numpy pyarrow opencv-python-headless

source_dir=$("$venv_python" - <<'PY'
from pathlib import Path
import sysconfig
import ais_bench.benchmark as benchmark

source = Path(next(iter(benchmark.__path__))).resolve()
expected = (Path(sysconfig.get_path("purelib")) / "ais_bench/benchmark").resolve()
if source != expected:
    raise RuntimeError(f"AISBench must be private to this venv: {source}")
print(source)
PY
)
command_path="$venv_dir/bin/ais_bench"
"$command_path" -h >/dev/null

# Publish complete Bash assignments atomically, only after imports and the CLI
# smoke check succeed. %q preserves spaces and shell metacharacters in paths.
mkdir -p -- "$(dirname -- "$env_file")"
pending_env=$(mktemp -- "${env_file}.tmp.XXXXXX")
trap 'rm -f -- "$pending_env"' EXIT
{
    printf 'AIS_BENCH_BIN=%q\n' "$command_path"
    printf 'AIS_BENCH_SOURCE=%q\n' "$source_dir"
} > "$pending_env"
mv -f -- "$pending_env" "$env_file"
