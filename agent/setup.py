"""
ONE-TIME SETUP — run this once per deployment.
Creates the Managed Agents environment and agent, then prints the IDs
to add to your agent/.env file.

Usage:
    pip install -r agent/requirements.txt
    cp agent/.env.example agent/.env   # fill in ANTHROPIC_API_KEY + GITHUB_TOKEN
    python agent/setup.py
"""
import anthropic
import os

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv("agent/.env")
except ImportError:
    pass

client = anthropic.Anthropic()

SYSTEM_PROMPT = """You are the FlatFinder autonomous build agent for FlatFinder Inc.

You have full authority to create files, install dependencies, write code, run tests, \
and structure the project. You do not ask clarifying questions mid-build. \
You do not produce instructions for a human to follow. You build the thing.

Immutable constraints — these override everything:
- British/Oxford English in all copy, comments, and documentation. Never American spelling.
- Authentication: Privy only — passwordless email + crypto wallets + social auth. \
No passwords anywhere.
- Subscription enforcement: Every paid feature checked on both frontend \
(useSubscriptionAccess hook) AND backend (API level). No exceptions.
- Legal footer on all apps: © 2024–2026 Lila Inglis Abegunrin. \
Trademarks and Patents Pending (CIPO).
- IP protection: The Anti-Gatekeeping Affordability Algorithm™ logic is never exposed \
client-side. All matching logic runs server-side only. No exceptions.
- MAAC™ and FlatFinder are fully independent: Never reference, mention, or \
cross-promote one in the other's context.
- Every source file you create must begin with this header comment:
  © 2024–2026 Lila Inglis Abegunrin. All Rights Reserved.
  FlatFinder Inc. · Trademarks and Patents Pending (CIPO) · PROPRIETARY AND CONFIDENTIAL

When you encounter a blocker (missing credential, external API key), stub it with an \
obvious placeholder, continue building, and log it in BLOCKERS.md at project root.

When all build phases are complete:
1. Run: git checkout -b ff-build-001
2. Run: git add -A
3. Run: git commit -m "feat: FF-BUILD-001 FlatFinder initial build"
4. Run: git push origin ff-build-001
5. Call the create_pull_request tool — this is mandatory as the final step.
"""

print("Creating environment...")
environment = client.beta.environments.create(
    name="flatfinder-build-env",
    config={
        "type": "cloud",
        "networking": {"type": "unrestricted"},
    },
)
print(f"  ✓ Environment: {environment.id}")

print("Creating agent...")
agent = client.beta.agents.create(
    name="FlatFinder PR Agent",
    model="claude-sonnet-4-6",
    system=SYSTEM_PROMPT,
    tools=[
        {
            "type": "agent_toolset_20260401",
            "default_config": {"enabled": True},
        },
        {
            "type": "custom",
            "name": "create_pull_request",
            "description": (
                "Create a GitHub pull request for the completed build. "
                "Call this as the final step, after pushing your branch. "
                "The pull request will be reviewed by the team."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "PR title, e.g. 'FF-BUILD-001: FlatFinder initial build'",
                    },
                    "body": {
                        "type": "string",
                        "description": (
                            "PR description in markdown. Include: phases completed, "
                            "assumptions made, and a pointer to BLOCKERS.md for credentials."
                        ),
                    },
                    "head": {
                        "type": "string",
                        "description": "The branch you pushed to, e.g. 'ff-build-001'",
                    },
                    "base": {
                        "type": "string",
                        "description": "Target branch. Default: main",
                    },
                },
                "required": ["title", "body", "head"],
            },
        },
    ],
)
print(f"  ✓ Agent: {agent.id}  (version {agent.version})")

print()
print("━" * 60)
print("Add these to your agent/.env file:")
print("━" * 60)
print(f"FLATFINDER_AGENT_ID={agent.id}")
print(f"FLATFINDER_ENVIRONMENT_ID={environment.id}")
print("━" * 60)
