"""End-to-end check of the agent pipeline with a scripted LLM (no network).

Run from backend/:  .venv/bin/python -m tests.test_agent_loop
"""

import asyncio
import json
import os
import tempfile
from collections import Counter

from app.brains import RealBrain
from app.pipeline import Job, run_job
from app.runtime import registry

PARAS = [f"Paragraph {i}. Captain Ahab met Ishmael at the Spouter Inn. " * 6 for i in range(5)]


class FakeClient:
    """Mimics LLMClient.chat: picks a reply by recognising which agent is asking."""

    def __init__(self):
        self.calls = Counter()
        self.reviewed = Counter()
        self.seen_memory = False
        self.seen_feedback = False

    async def chat(self, system, user, temperature=0.7, **_):
        await asyncio.sleep(0.01)
        if user.startswith("New order"):
            self.calls["manager"] += 1
            return json.dumps({
                "domain": "literary", "confidence": 0.9, "target_reader": "adult readers",
                "locale": "Taiwan", "guidelines": ["keep tone"], "naturalness_pitfalls": [],
                "quality_requirements": ["fluent"], "reasoning": "fiction", "client_reply": "On it!",
            })
        if user.startswith("Review"):
            self.calls["review"] += 1
            key = user.split("Draft:")[1][:60]
            self.reviewed[key] += 1
            if "Job memory" in user:
                self.seen_memory = True
            # First draft of passage 1 is sent back; the redo passes.
            if "DRAFT-1" in user and "REDO" not in user:
                return "- [Accuracy] dropped a clause\nVERDICT: REVISE"
            return "- fine\nVERDICT: PASS"
        if user.startswith("Produce the final"):
            self.calls["improve"] += 1
            return user.split("Draft:\n\"\"\"\n")[1].split("\n\"\"\"")[0] + " [EDITED]"
        if user.startswith("From this finished"):
            self.calls["memory"] += 1
            return json.dumps({"decisions": [{"source": "Captain Ahab", "target": "亞哈船長", "note": "name"}]})
        if user.startswith("Translate passage"):
            self.calls["translate"] += 1
            idx = int(user.split("Translate passage ")[1].split(" ")[0]) - 1
            if "sent your previous draft back" in user:
                self.seen_feedback = True
                return f"DRAFT-{idx} REDO"
            return f"DRAFT-{idx}"
        raise AssertionError("unexpected prompt: " + user[:80])


async def main():
    registry.reload()
    assert {"manager", "literary", "editor_review", "terminologist"} <= set(registry.load_agents())
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "story.txt")
        with open(src, "w") as f:
            f.write("\n\n".join(PARAS))
        job = Job(job_id="t" * 32, out_dir=tmp, file_path=src, file_name="story.txt",
                  source_lang="English", target_lang="Chinese (Traditional, Taiwan)",
                  translation_type="Help me to decide", brief="novel", output_format="txt",
                  chunk_size=400, provider="openai", model="fake")
        client = FakeClient()
        events = []
        await asyncio.wait_for(run_job(job, RealBrain(client, {}), events.append), timeout=30)

    types = Counter(e["type"] for e in events)
    errors = [e for e in events if e["type"] == "error"]
    assert not errors, errors
    total = next(e["chunks"] for e in events if e["type"] == "chunking_done")
    assert types["completed"] == 1, types
    assert types["revision_requested"] == 1, types
    assert types["translate_done"] == total + 1, types          # one redo
    assert types["improve_done"] == total, types
    assert client.seen_feedback, "redo prompt did not include editor notes"
    assert client.seen_memory, "later prompts never saw job memory"
    assert types["memory_updated"] == 1, types                   # duplicate decisions are not re-added
    print(f"OK: {total} passages, 1 redo, calls={dict(client.calls)}")


if __name__ == "__main__":
    asyncio.run(main())
