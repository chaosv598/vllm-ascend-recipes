from __future__ import annotations

import re
import subprocess
import unittest
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = (
    ROOT / ".github" / "workflows" / "pr-recipe-verify.yml",
    ROOT / ".github" / "workflows" / "verify_multi_node.yaml",
)


class WorkflowLintRegressionTests(unittest.TestCase):
    def test_related_github_outputs_use_one_redirection_block(self) -> None:
        consecutive_redirects = re.compile(
            r'(?m)^(?:[ \t]*echo .*>> "\$GITHUB_OUTPUT"\n){2,}'
        )
        for workflow in WORKFLOWS:
            self.assertIsNone(
                consecutive_redirects.search(workflow.read_text()),
                f"{workflow} contains consecutive GITHUB_OUTPUT redirects",
            )

    def test_workflow_run_blocks_have_valid_shell_syntax(self) -> None:
        for workflow in (ROOT / ".github" / "workflows").glob("*.y*ml"):
            document = yaml.safe_load(workflow.read_text())
            for job_name, job in document.get("jobs", {}).items():
                for step_index, step in enumerate(job.get("steps", [])):
                    script = step.get("run")
                    shell = step.get("shell", "bash")
                    if not script or not shell.startswith("bash"):
                        continue
                    result = subprocess.run(
                        ["bash", "-n"],
                        input=script,
                        text=True,
                        capture_output=True,
                        check=False,
                    )
                    self.assertEqual(
                        result.returncode,
                        0,
                        f"{workflow}:{job_name}:step {step_index + 1}: "
                        f"{result.stderr.strip()}",
                    )


if __name__ == "__main__":
    unittest.main()
