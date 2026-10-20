"""Exercise the CI installer without downloading benchmark dependencies."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
import yaml


ROOT = Path(__file__).resolve().parents[2]
INSTALLER = ROOT / "scripts/install-ci-aisbench.sh"
CONSTRAINTS = ROOT / "scripts/ci-aisbench-constraints.txt"

# Replace only the external package installer. The venv, imports, console
# executable, shell publication and subprocess exit handling remain real.
PIP_FIXTURE = r'''
import json
import os
from pathlib import Path
import shlex
import sys
import sysconfig

args = sys.argv[1:]
event = {
    "kind": "pip", "args": args, "prefix": sys.prefix,
    "config": os.environ.get("PIP_CONFIG_FILE"),
    "redirects": {key: os.environ[key] for key in
                  ("PIP_TARGET", "PIP_PREFIX", "PIP_USER", "PIP_PYTHON")
                  if key in os.environ},
}
constraint = Path(args[args.index("--constraint") + 1])
event["constraints"] = dict(
    line.strip().split("==") for line in constraint.read_text().splitlines()
    if line.strip() and not line.lstrip().startswith("#")
)
with open(os.environ["FIXTURE_LOG"], "a") as log:
    log.write(json.dumps(event) + "\n")
phase = "seed" if "--no-deps" in args else "dependencies"
if os.environ.get("FIXTURE_FAIL") == phase:
    raise SystemExit(32 if phase == "seed" else 33)
site = Path(sysconfig.get_path("purelib"))
benchmark = site / "ais_bench/benchmark"
benchmark.mkdir(parents=True, exist_ok=True)
(site / "ais_bench/__init__.py").touch()
(benchmark / "__init__.py").write_text(
    'import os\nif os.environ.get("FIXTURE_FAIL") == "import":\n'
    '    raise RuntimeError("fixture import failed")\n'
)
(benchmark / "model.py").write_text("# private model fixture\n")
command = Path(sys.prefix) / "bin/ais_bench"
command_source = r"""
import json
import os
from pathlib import Path
import sys
import ais_bench.benchmark
with open(os.environ["FIXTURE_LOG"], "a") as log:
    log.write(json.dumps({"kind": "help", "args": sys.argv[1:],
                         "published": Path(os.environ["FIXTURE_ENV_FILE"]).exists()}) + "\n")
raise SystemExit(35 if os.environ.get("FIXTURE_FAIL") == "help" else 0)
"""
# Like pip's generated launchers, support interpreter paths containing spaces.
command.write_text("#!/usr/bin/env bash\nexec " + shlex.quote(sys.executable)
                   + " -c " + shlex.quote(command_source) + ' "$@"\n')
command.chmod(0o755)
'''


class CIAisbenchInstallTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.env_file = self.root / "output with 'quotes'" / "aisbench.env"
        self.venv = self.root / "venv with 'quotes'"
        self.log = self.root / "calls.jsonl"
        self.pip_fixture = self.root / "pip-fixture.py"
        self.pip_fixture.write_text(textwrap.dedent(PIP_FIXTURE), encoding="utf-8")
        self.fake_bin = self.root / "bin"
        self.fake_bin.mkdir()
        self.python = self.fake_bin / "python3"
        self.python.write_text(
            f"#!{sys.executable}\n" + textwrap.dedent('''\
                import json
                import os
                from pathlib import Path
                import shutil
                import subprocess
                import sys

                args = sys.argv[1:]
                with open(os.environ["FIXTURE_LOG"], "a") as log:
                    log.write(json.dumps({"kind": "venv", "args": args}) + "\\n")
                if args[:2] != ["-m", "venv"] or "--system-site-packages" not in args:
                    raise SystemExit("unexpected bootstrap Python invocation")
                if os.environ.get("FIXTURE_FAIL") == "venv":
                    raise SystemExit(31)
                subprocess.run([sys.executable, *args, "--without-pip"], check=True)
                venv = Path(args[-1])
                site = subprocess.check_output(
                    [str(venv / "bin/python"), "-c",
                     'import sysconfig; print(sysconfig.get_path("purelib"))'],
                    text=True,
                ).strip()
                pip = Path(site) / "pip"
                pip.mkdir()
                (pip / "__init__.py").touch()
                shutil.copyfile(os.environ["FIXTURE_PIP"], pip / "__main__.py")
            '''), encoding="utf-8",
        )
        self.python.chmod(0o755)

    def run_installer(self, *, default_directory=False, fallback_python=False,
                      failure="", arguments=None, overrides=None):
        environment = os.environ.copy()
        environment.update({
            "PYTHON": str(self.python),
            "CI_AISBENCH_ENV_DIR": str(self.venv),
            "FIXTURE_LOG": str(self.log),
            "FIXTURE_PIP": str(self.pip_fixture),
            "FIXTURE_ENV_FILE": str(self.env_file),
            "FIXTURE_FAIL": failure,
            "PYTHONDONTWRITEBYTECODE": "1",
            "PATH": f"{self.fake_bin}:{environment['PATH']}",
        })
        if default_directory:
            environment.pop("CI_AISBENCH_ENV_DIR")
        if fallback_python:
            environment.pop("PYTHON")
        environment.update(overrides or {})
        return subprocess.run(
            ["bash", str(INSTALLER), *(arguments if arguments is not None else
                                      ["--env-file", str(self.env_file)])],
            env=environment, cwd=self.root, text=True, capture_output=True,
        )

    def events(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def published(self):
        result = subprocess.run(
            ["bash", "-c", 'source "$1"; printf "%s\\n%s\\n" '
             '"$AIS_BENCH_BIN" "$AIS_BENCH_SOURCE"', "bash", str(self.env_file)],
            text=True, capture_output=True, check=True,
        )
        command, source = map(Path, result.stdout.splitlines())
        self.assertEqual(len(self.env_file.read_text().splitlines()), 2)
        return command, source

    def assert_success(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_installs_private_package_with_bounded_dependencies_and_checks_help(self):
        # Catches global pip, missing dependency bounds, reused image configs,
        # wrong publication paths and publication before the CLI smoke check.
        self.assert_success(self.run_installer())
        command, source = self.published()
        self.assertEqual(command, self.venv / "bin/ais_bench")
        self.assertTrue(source.is_relative_to(self.venv))
        self.assertEqual(source.parts[-3:], ("site-packages", "ais_bench", "benchmark"))
        self.assertTrue((source / "model.py").is_file())
        events = self.events()
        self.assertEqual(events[0]["args"],
                         ["-m", "venv", "--system-site-packages", str(self.venv)])
        installs = [event for event in events if event["kind"] == "pip"]
        self.assertEqual(len(installs), 2)
        self.assertIn("--ignore-installed", installs[0]["args"])
        self.assertIn("--no-deps", installs[0]["args"])
        self.assertNotIn("--no-deps", installs[1]["args"])
        for install in installs:
            self.assertEqual(Path(install["prefix"]), self.venv)
            self.assertIn("--require-virtualenv", install["args"])
            self.assertIn("ais_bench_benchmark==3.1.20260630", install["args"])
            self.assertEqual(install["constraints"], {
                "ais_bench_benchmark": "3.1.20260630", "numpy": "1.26.4",
                "pyarrow": "25.0.1", "opencv-python-headless": "4.11.0.86",
            })
            self.assertEqual(Path(install["args"][install["args"].index("--constraint") + 1]),
                             CONSTRAINTS)
        for package in ("numpy", "pyarrow", "opencv-python-headless"):
            self.assertIn(package, installs[1]["args"])
        self.assertEqual(events[-1], {"kind": "help", "args": ["-h"], "published": False})

    def test_default_directory_is_unique_under_tmp_even_with_tmpdir_override(self):
        # A shared environment would let one job's model patch leak into another.
        sources = []
        for _ in range(2):
            self.assert_success(self.run_installer(
                default_directory=True, fallback_python=True,
                overrides={"TMPDIR": str(self.root)},
            ))
            command, source = self.published()
            venv = command.parent.parent
            self.assertEqual(venv.parent, Path("/tmp"))
            self.assertTrue(venv.name.startswith("ci-aisbench."))
            self.addCleanup(shutil.rmtree, venv)
            self.assertFalse((source / "private-patch").exists())
            (source / "private-patch").touch()
            sources.append(source)
            self.env_file.unlink()
        self.assertNotEqual(*sources)

    def test_relative_override_publishes_absolute_paths(self):
        self.assert_success(self.run_installer(overrides={"CI_AISBENCH_ENV_DIR": "relative-venv"}))
        command, source = self.published()
        self.assertEqual(command, self.root / "relative-venv/bin/ais_bench")
        self.assertTrue(source.is_absolute())

    def test_does_not_reuse_an_existing_environment(self):
        # Reusing even an otherwise valid venv would share mutable config files.
        self.assert_success(self.run_installer())
        _, source = self.published()
        marker = source / "private-patch"
        marker.write_text("keep")
        self.env_file.unlink()
        self.log.unlink()
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.env_file.exists())
        self.assertFalse(self.log.exists())
        self.assertEqual(marker.read_text(), "keep")

    def test_inherited_pip_settings_cannot_redirect_installation(self):
        # Explicit redirects and pip config must not send writes outside the venv.
        outside = self.root / "outside"
        self.assert_success(self.run_installer(overrides={
            "PIP_TARGET": str(outside), "PIP_PREFIX": str(outside),
            "PIP_USER": "1", "PIP_PYTHON": sys.executable,
            "PIP_CONFIG_FILE": str(self.root / "unsafe-pip.conf"),
        }))
        for event in self.events():
            if event["kind"] == "pip":
                self.assertEqual(event["redirects"], {})
                self.assertEqual(event["config"], "/dev/null")
        self.assertFalse(outside.exists())

    def test_failures_propagate_without_publishing_environment(self):
        # Losing any of these exit checks would publish an unusable benchmark.
        for failure, code in (("venv", 31), ("seed", 32),
                              ("dependencies", 33), ("import", 1), ("help", 35)):
            with self.subTest(failure=failure):
                result = self.run_installer(
                    failure=failure,
                    overrides={"CI_AISBENCH_ENV_DIR": str(self.root / failure)},
                )
                self.assertEqual(result.returncode, code, result.stdout + result.stderr)
                self.assertFalse(self.env_file.exists())

    def test_bad_cli_fails_before_creating_environment(self):
        for args in ([], ["--env-file"], ["--env-file", ""],
                     ["--unknown"], ["--env-file", str(self.env_file), "extra"]):
            with self.subTest(args=args):
                result = self.run_installer(arguments=args)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertFalse(self.log.exists())
                self.assertFalse(self.env_file.exists())
                self.assertFalse(self.venv.exists())


class BenchmarkWorkflowTests(unittest.TestCase):
    def test_installer_timeout_is_non_gating_and_api_step_can_continue(self):
        workflow = yaml.safe_load((ROOT / ".github/workflows/_recipe_verify.yml").read_text(encoding="utf-8"))
        step = next(item for item in workflow["jobs"]["recipe-verify"]["steps"]
                    if item.get("name") == "Install benchmark tools")
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "scripts").mkdir()
            (root / "bin").mkdir()
            (root / "scripts/install-ci-aisbench.sh").write_text("sleep 5\n", encoding="utf-8")
            timer = root / "bin/timeout"
            timer.write_text('#!/bin/bash\nshift 3\nexec /usr/bin/timeout -k .1s .1s "$@"\n', encoding="utf-8")
            timer.chmod(0o755)
            try:
                result = subprocess.run(["bash", "-e", "-c", step["run"] + "\necho API_VERIFICATION_CAN_CONTINUE"],
                    cwd=root, env={**os.environ, "PATH": f"{root / 'bin'}:{os.environ['PATH']}"},
                    capture_output=True, text=True, timeout=2)
            except subprocess.TimeoutExpired:
                self.fail("benchmark setup must have a handled inner timeout before the Actions step timeout")
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("::warning::AISBench setup failed", result.stdout)
            self.assertIn("API_VERIFICATION_CAN_CONTINUE", result.stdout)
        self.assertTrue(step.get("continue-on-error"), "optional setup must not prevent API verification")


if __name__ == "__main__":
    unittest.main()
