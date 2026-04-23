"""
RUNTIME — fire-and-forget: kick off a FlatFinder build session.

The agent mounts this repository, reads FF-BUILD-001.md, builds all phases,
and opens a pull request when done. You can walk away.

Usage:
    python agent/run.py

Prerequisites:
    1. Run agent/setup.py once and save the output IDs to agent/.env
    2. Fill in GITHUB_TOKEN in agent/.env (needs 'repo' scope)
"""
import anthropic
import os
import requests

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv("agent/.env")
except ImportError:
    pass

REPO_OWNER = "flatfinderai-cyber"
REPO_NAME = "studious-bassoon"

client = anthropic.Anthropic()

TASK = """
Read the full contents of /workspace/studious-bassoon/FF-BUILD-001.md.

Execute every phase (1 through 8) exactly as specified. Do not skip any task.
Do not ask questions. Build the thing.

Work inside /workspace/studious-bassoon/ — this is the project root.

When all phases are complete:
1. git checkout -b ff-build-001
2. git add -A
3. git commit -m "feat: FF-BUILD-001 FlatFinder initial build"
4. git push origin ff-build-001
5. Call the create_pull_request tool with:
   - title: "FF-BUILD-001: FlatFinder initial build"
   - body: a markdown summary of completed phases, assumptions, and a note
     directing the reviewer to BLOCKERS.md for required credentials
   - head: "ff-build-001"
   - base: "main"
"""


def create_github_pr(inputs: dict) -> str:
    """Called when the agent uses the create_pull_request tool."""
    resp = requests.post(
        f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/pulls",
        headers={
            "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        json={
            "title": inputs["title"],
            "body": inputs.get("body", ""),
            "head": inputs["head"],
            "base": inputs.get("base", "main"),
        },
        timeout=30,
    )
    data = resp.json()
    if resp.status_code == 201:
        url = data["html_url"]
        print(f"\n  ✓ Pull request created: {url}")
        return f"Pull request created successfully: {url}"
    error = data.get("message", resp.text)
    print(f"\n  ✗ PR creation failed ({resp.status_code}): {error}")
    return f"Error creating pull request: {error}"


# --- Create session -----------------------------------------------------------

print("Starting FlatFinder build session...")
session = client.beta.sessions.create(
    agent=os.environ["FLATFINDER_AGENT_ID"],
    environment_id=os.environ["FLATFINDER_ENVIRONMENT_ID"],
    title="FF-BUILD-001 FlatFinder initial build",
    resources=[
        {
            "type": "github_repository",
            "url": f"https://github.com/{REPO_OWNER}/{REPO_NAME}",
            "authorization_token": os.environ["GITHUB_TOKEN"],
            "mount_path": f"/workspace/{REPO_NAME}",
            "checkout": {"type": "branch", "name": "main"},
        }
    ],
)
print(f"Session: {session.id}")
print("Agent is building FlatFinder — grab a coffee, this will take a while.\n")
print("─" * 60)

# --- Stream events (stream-first, then send the task) -------------------------

with client.beta.sessions.stream(session_id=session.id) as stream:
    client.beta.sessions.events.send(
        session_id=session.id,
        events=[{
            "type": "user.message",
            "content": [{"type": "text", "text": TASK}],
        }],
    )

    for event in stream:

        if event.type == "agent.message":
            for block in event.content:
                if block.type == "text":
                    print(block.text, end="", flush=True)

        elif event.type == "agent.custom_tool_use":
            if event.tool_name == "create_pull_request":
                result = create_github_pr(event.input)
                client.beta.sessions.events.send(
                    session_id=session.id,
                    events=[{
                        "type": "user.custom_tool_result",
                        "custom_tool_use_id": event.id,
                        "content": [{"type": "text", "text": result}],
                    }],
                )

        elif event.type == "session.status_idle":
            # Only break on a terminal stop reason; stay in loop if waiting
            # on a tool result (requires_action)
            stop_reason = getattr(event, "stop_reason", None)
            stop_type = getattr(stop_reason, "type", None) if stop_reason else None
            if stop_type != "requires_action":
                break

        elif event.type == "session.status_terminated":
            break

print(f"\n{'─' * 60}")
print(f"Build session complete.")
print(f"Session ID: {session.id}")
