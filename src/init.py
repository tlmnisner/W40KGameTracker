import signal
import subprocess
import sys
from pathlib import Path


SRC_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = SRC_ROOT / "backend"
FRONTEND_DIR = SRC_ROOT / "frontend"

processes: list[subprocess.Popen] = []


def stop_processes(*_args: object) -> None:
    for process in processes:
        if process.poll() is None:
            process.terminate()

    for process in processes:
        process.wait()

    sys.exit(0)


def main() -> None:
    signal.signal(signal.SIGINT, stop_processes)
    signal.signal(signal.SIGTERM, stop_processes)

    commands = [
        (
            "backend",
            BACKEND_DIR,
            [sys.executable, "-m", "uvicorn", "main:app", "--port", "8000"],
        ),
        (
            "frontend",
            FRONTEND_DIR,
            [sys.executable, "-m", "uvicorn", "main:app", "--port", "8080"],
        ),
    ]

    for name, directory, command in commands:
        print(f"Starting {name} on port {command[-1]}...")
        processes.append(subprocess.Popen(command, cwd=directory))

    try:
        exit_codes = [process.wait() for process in processes]
        if any(code != 0 for code in exit_codes):
            raise SystemExit(max(exit_codes))
    finally:
        stop_processes()


if __name__ == "__main__":
    main()
